import { randomUUID } from 'crypto'
import {
  AppError, publish, createServiceClient,
  logger
} from '@clickup/sdk'
import {
  Task, CreateTaskInput, UpdateTaskInput, TASK_EVENTS,
  TaskCreatedEvent, TaskUpdatedEvent, TaskDeletedEvent, ErrorCode
} from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

export class TasksService {
  private readonly identityClient = createServiceClient(
    process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001'
  )

  constructor(private readonly repo: TasksRepository) {}

  async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
    const list = await this.getList(input.listId)
    if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    
    await this.assertWorkspaceMember(list.workspaceId, userId)

    let path = ''
    let parentPath = ''
    if (input.parentId) {
      const parent = await this.repo.findById(input.parentId)
      if (!parent) throw new AppError(ErrorCode.TASK_INVALID_PARENT)
      parentPath = parent.path
    }

    const taskId = randomUUID()
    path = input.parentId ? `${parentPath}${taskId}/` : `/${input.listId}/${taskId}/`
    const position = (await this.repo.getMaxPosition(input.listId, input.parentId ?? null)) + 1000

    const task = await this.repo.create({
      ...input,
      id: taskId,
      path,
      position,
      createdBy: userId,
      status: input.status ?? 'Todo',
      priority: input.priority ?? 'normal'
    })

    await publish(TASK_EVENTS.CREATED as any, {
      taskId: task.id,
      workspaceId: list.workspaceId,
      listId: task.listId,
      createdBy: userId,
      occurredAt: new Date().toISOString()
    } as TaskCreatedEvent)

    return task
  }

  async getTask(id: string, userId: string): Promise<Task> {
    const task = await this.repo.findById(id)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)
    
    const list = await this.getList(task.listId)
    if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await this.assertWorkspaceMember(list.workspaceId, userId)

    return task
  }

  async updateTask(id: string, input: UpdateTaskInput, userId: string): Promise<Task> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const list = await this.getList(existing.listId)
    if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await this.assertWorkspaceMember(list.workspaceId, userId)

    const updated = await this.repo.update(id, input)
    if (!updated) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    await publish(TASK_EVENTS.UPDATED as any, {
      taskId: id,
      workspaceId: list.workspaceId,
      updatedBy: userId,
      occurredAt: new Date().toISOString()
    } as TaskUpdatedEvent)

    return updated
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    const task = await this.repo.findById(id)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const list = await this.getList(task.listId)
    if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await this.assertWorkspaceMember(list.workspaceId, userId)

    const deletedIds = await this.repo.softDelete(id, task.path)

    await publish(TASK_EVENTS.DELETED as any, {
      taskId: id,
      workspaceId: list.workspaceId,
      deletedIds,
      deletedBy: userId,
      occurredAt: new Date().toISOString()
    } as any)
  }

  private async getList(listId: string) {
    try {
      const { data } = await this.identityClient.get(`/api/v1/lists/${listId}`)
      return data
    } catch {
      return null
    }
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    try {
      await this.identityClient.get(`/api/v1/workspaces/${workspaceId}/members/${userId}`)
    } catch {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }
  }
}
