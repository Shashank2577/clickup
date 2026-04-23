import { randomUUID } from 'crypto';
import { AppError, createServiceClient, publish } from '@clickup/sdk';
import { ErrorCode, TASK_EVENTS } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
export class TasksService {
    repository;
    identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001';
    constructor(repository) {
        this.repository = repository;
    }
    getIdentityClient(traceId) {
        const options = {};
        if (traceId)
            options.traceId = traceId;
        return createServiceClient(this.identityUrl, options);
    }
    async verifyMembership(workspaceId, userId, traceId) {
        const client = this.getIdentityClient(traceId);
        try {
            const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId);
            const member = response.data?.data || response.data;
            if (!member)
                throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
            return member;
        }
        catch (err) {
            if (err instanceof AppError)
                throw err;
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    }
    async createTask(userId, input, traceId) {
        const meta = await this.repository.getListMetadata(input.listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        await this.verifyMembership(meta.workspace_id, userId, traceId);
        let parentPath = '/' + input.listId + '/';
        if (input.parentId) {
            const parent = await this.repository.getTask(input.parentId);
            if (!parent || parent.list_id !== input.listId)
                throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid parent task');
            parentPath = parent.path;
        }
        const taskId = randomUUID();
        const path = parentPath + taskId + '/';
        const task = await this.repository.createTask({
            id: taskId,
            listId: input.listId,
            title: input.title,
            parentId: input.parentId || null,
            path,
            createdBy: userId,
            priority: input.priority,
            assigneeId: input.assigneeId
        });
        await publish(TASK_EVENTS.CREATED, {
            taskId: task.id,
            listId: task.list_id,
            spaceId: meta.space_id,
            workspaceId: meta.workspace_id,
            title: task.title,
            createdBy: userId,
            assigneeId: task.assignee_id,
            parentId: task.parent_id,
            occurredAt: new Date().toISOString(),
        });
        return task;
    }
    async getTask(userId, taskId, traceId) {
        const task = await this.repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await this.repository.getListMetadata(task.list_id);
        await this.verifyMembership(meta.workspace_id, userId, traceId);
        return task;
    }
    async listTasks(userId, listId, page, pageSize, traceId) {
        const meta = await this.repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        await this.verifyMembership(meta.workspace_id, userId, traceId);
        const tasks = await this.repository.listTasks(listId, pageSize, (page - 1) * pageSize);
        const total = await this.repository.countTasks(listId);
        return {
            data: tasks,
            total,
            page,
            pageSize,
            hasMore: total > page * pageSize
        };
    }
    async updateTask(userId, taskId, updates, traceId) {
        const task = await this.repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await this.repository.getListMetadata(task.list_id);
        await this.verifyMembership(meta.workspace_id, userId, traceId);
        const updated = await this.repository.updateTask(taskId, updates);
        await publish(TASK_EVENTS.UPDATED, {
            taskId: updated.id,
            listId: updated.list_id,
            workspaceId: meta.workspace_id,
            changes: updates,
            updatedBy: userId,
            occurredAt: new Date().toISOString(),
        });
        if (updates.assigneeId && updates.assigneeId !== task.assignee_id) {
            await publish(TASK_EVENTS.ASSIGNED, {
                taskId: updated.id,
                listId: updated.list_id,
                workspaceId: meta.workspace_id,
                assigneeId: updates.assigneeId,
                previousAssigneeId: task.assignee_id,
                assignedBy: userId,
                occurredAt: new Date().toISOString(),
            });
        }
        return updated;
    }
    async deleteTask(userId, taskId, traceId) {
        const task = await this.repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await this.repository.getListMetadata(task.list_id);
        const member = await this.verifyMembership(meta.workspace_id, userId, traceId);
        if (task.created_by !== userId && !['owner', 'admin'].includes(member.role || member.data?.role)) {
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        }
        await this.repository.softDeleteWithPath(task.path);
        await publish(TASK_EVENTS.DELETED, {
            taskId: task.id,
            listId: task.list_id,
            workspaceId: meta.workspace_id,
            deletedBy: userId,
            occurredAt: new Date().toISOString(),
        });
    }
}
export const createTasksService = (db) => new TasksService(new TasksRepository(db));
//# sourceMappingURL=tasks.service.js.map