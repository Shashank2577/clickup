import { validate, asyncHandler } from '@clickup/sdk';
import { CreateTaskSchema, UpdateTaskSchema, TaskListQuerySchema } from '@clickup/contracts';
import { createTasksService } from './tasks.service.js';
export function createTaskHandler(db) {
    const service = createTasksService(db);
    return asyncHandler(async (req, res) => {
        const input = validate(CreateTaskSchema, req.body);
        const task = await service.createTask(req.auth.userId, input, req.headers['x-trace-id']);
        res.status(201).json({ data: task });
    });
}
export function getTaskHandler(db) {
    const service = createTasksService(db);
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await service.getTask(req.auth.userId, taskId, req.headers['x-trace-id']);
        res.json({ data: task });
    });
}
export function listTasksHandler(db) {
    const service = createTasksService(db);
    return asyncHandler(async (req, res) => {
        const { listId } = req.params;
        const query = validate(TaskListQuerySchema, req.query);
        const result = await service.listTasks(req.auth.userId, listId, Number(query.page || 1), Number(query.pageSize || 50), req.headers['x-trace-id']);
        res.json(result);
    });
}
export function updateTaskHandler(db) {
    const service = createTasksService(db);
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const updates = validate(UpdateTaskSchema, req.body);
        const task = await service.updateTask(req.auth.userId, taskId, updates, req.headers['x-trace-id']);
        res.json({ data: task });
    });
}
export function deleteTaskHandler(db) {
    const service = createTasksService(db);
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        await service.deleteTask(req.auth.userId, taskId, req.headers['x-trace-id']);
        res.status(204).end();
    });
}
// ── Archive / Unarchive ─────────────────────────────────────────────────────
// Archive: soft-hide without soft-deleting. Archived tasks don't appear in
// normal list queries but are retrievable with ?includeArchived=true.
// Uses the completed_at column repurposed: set a special archived_at flag via
// a JSONB payload stored in description? No — cleaner to add a column via
// migration or just use deleted_at with a twist. We use a separate boolean approach:
// set status = 'archived' (a special reserved status value).
import { AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
export function archiveTaskHandler(db) {
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const repository = new TasksRepository(db);
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        // Verify workspace membership
        const meta = await repository.getListMetadata(task.list_id);
        if (!meta)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const memberResult = await db.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        // Archive = set status to 'archived' and mark completed_at
        await db.query(`UPDATE tasks SET status = 'archived', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [taskId]);
        res.json({ data: { archived: true } });
    });
}
export function unarchiveTaskHandler(db) {
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const repository = new TasksRepository(db);
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await repository.getListMetadata(task.list_id);
        if (!meta)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const memberResult = await db.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        await db.query(`UPDATE tasks SET status = 'todo', completed_at = NULL, updated_at = NOW() WHERE id = $1`, [taskId]);
        res.json({ data: { archived: false } });
    });
}
//# sourceMappingURL=tasks.handler.js.map