import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { 
  AppError, 
  createServiceClient, 
  publish, 
  logger 
} from '@clickup/sdk'
import { 
  ErrorCode, 
  TASK_EVENTS,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskAssignedEvent,
  TaskPriority
} from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

export class TasksService {
  private identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  constructor(private readonly repository: TasksRepository) {}

  private getIdentityClient(traceId?: string) {
    const options: { traceId?: string } = {}
    if (traceId) options.traceId = traceId
    return createServiceClient(this.identityUrl, options) as any
  }

  private async verifyMembership(workspaceId: string, userId: string, _traceId?: string) {
    // Direct DB query — both services share the same database
    // This avoids the circular service-to-service auth problem
    if (!workspaceId) return { userId, role: 'member' }
    try {
      const { rows } = await this.repository['db'].query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      )
      if (rows.length === 0) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      return { userId, role: rows[0].role }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      return { userId, role: 'member' }
    }
  }

  async createTask(userId: string, input: { title: string, listId: string, parentId?: string, priority?: TaskPriority, assigneeId?: string }, traceId?: string) {
    const meta = await this.repository.getListMetadata(input.listId)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    await this.verifyMembership(meta.workspace_id, userId, traceId)

    let parentPath = '/' + input.listId + '/'
    if (input.parentId) {
      const parent = await this.repository.getTask(input.parentId)
      if (!parent || parent.list_id !== input.listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid parent task')
      parentPath = parent.path
    }

    const taskId = randomUUID()
    const path = parentPath + taskId + '/'

    const task = await this.repository.createTask({
      id: taskId,
      listId: input.listId,
      title: input.title,
      parentId: input.parentId || null,
      path,
      createdBy: userId,
      priority: input.priority,
      assigneeId: input.assigneeId
    } as any)

    await publish(TASK_EVENTS.CREATED as any, {
      taskId: task.id,
      listId: task.list_id,
      spaceId: meta.space_id,
      workspaceId: meta.workspace_id,
      title: task.title,
      createdBy: userId,
      assigneeId: task.assignee_id,
      parentId: task.parent_id,
      occurredAt: new Date().toISOString(),
    } as any)

    return task
  }

  async getTask(userId: string, taskId: string, traceId?: string) {
    const task = await this.repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await this.repository.getListMetadata(task.list_id)
    await this.verifyMembership(meta.workspace_id, userId, traceId)

    return task
  }

  async listTasks(userId: string, listId: string, page: number, pageSize: number, traceId?: string) {
    const meta = await this.repository.getListMetadata(listId)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    await this.verifyMembership(meta.workspace_id, userId, traceId)

    const tasks = await this.repository.listTasks(listId, pageSize, (page - 1) * pageSize)
    const total = await this.repository.countTasks(listId)

    return {
      data: tasks,
      total,
      page,
      pageSize,
      hasMore: total > page * pageSize
    }
  }

  async updateTask(userId: string, taskId: string, updates: any, traceId?: string) {
    const task = await this.repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await this.repository.getListMetadata(task.list_id)
    await this.verifyMembership(meta.workspace_id, userId, traceId)

    const updated = await this.repository.updateTask(taskId, updates)

    await publish(TASK_EVENTS.UPDATED as any, {
      taskId: updated.id,
      listId: updated.list_id,
      workspaceId: meta.workspace_id,
      changes: updates,
      updatedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    if (updates.assigneeId && updates.assigneeId !== task.assignee_id) {
      await publish(TASK_EVENTS.ASSIGNED as any, {
        taskId: updated.id,
        listId: updated.list_id,
        workspaceId: meta.workspace_id,
        assigneeId: updates.assigneeId,
        previousAssigneeId: task.assignee_id,
        assignedBy: userId,
        occurredAt: new Date().toISOString(),
      } as any)
    }

    return updated
  }

  async deleteTask(userId: string, taskId: string, traceId?: string) {
    const task = await this.repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await this.repository.getListMetadata(task.list_id)
    const member = await this.verifyMembership(meta.workspace_id, userId, traceId)
    
    if (task.created_by !== userId && !['owner', 'admin'].includes(member.role || member.data?.role)) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
    }

    await this.repository.softDeleteWithPath(task.path)

    await publish(TASK_EVENTS.DELETED as any, {
      taskId: task.id,
      listId: task.list_id,
      workspaceId: meta.workspace_id,
      deletedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)
  }
}

export const createTasksService = (db: Pool) => new TasksService(new TasksRepository(db))
