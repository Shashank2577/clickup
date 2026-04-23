import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

// Mounted at /:taskId/assignees (mergeParams: true)
export function assigneesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new TasksRepository(db)

  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  async function verifyMembership(workspaceId: string, userId: string) {
    const client = createServiceClient(identityUrl, {}) as any
    try {
      const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId)
      const member = response.data?.data || response.data
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }
  }

  async function getAssignees(taskId: string): Promise<any[]> {
    const { rows } = await db.query(
      `SELECT ta.task_id, ta.user_id, ta.assigned_at, ta.assigned_by,
              u.name, u.avatar_url
       FROM task_assignees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.task_id = $1
       ORDER BY ta.assigned_at ASC`,
      [taskId],
    )
    return rows
  }

  // GET /:taskId/assignees
  router.get('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    const assignees = await getAssignees(taskId)
    res.json({ data: assignees })
  }))

  // POST /:taskId/assignees — add assignee (idempotent via ON CONFLICT DO NOTHING)
  router.post('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }
    const { userId } = req.body as { userId: string }

    if (!userId) throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'userId is required')

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    await db.query(
      `INSERT INTO task_assignees (task_id, user_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (task_id, user_id) DO NOTHING`,
      [taskId, userId, req.auth.userId],
    )

    const assignees = await getAssignees(taskId)
    res.status(200).json({ data: assignees })
  }))

  // DELETE /:taskId/assignees/:userId
  router.delete('/:userId', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId, userId } = req.params as { taskId: string; userId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    await db.query(
      'DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2',
      [taskId, userId],
    )

    res.status(204).end()
  }))

  return router
}
