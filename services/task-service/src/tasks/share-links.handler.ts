import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

// Mounted at /:taskId/share (mergeParams: true)
export function shareLinksRouter(db: Pool): Router {
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

  // POST /:taskId/share — create or activate share link
  router.post('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    const { rows } = await db.query(
      `INSERT INTO task_public_links (task_id, created_by)
       VALUES ($1, $2)
       ON CONFLICT (task_id) DO UPDATE SET is_active = TRUE
       RETURNING *`,
      [taskId, req.auth.userId],
    )
    const link = rows[0]

    res.status(201).json({ data: { id: link.id, taskId: link.task_id, token: link.token, isActive: link.is_active, expiresAt: link.expires_at, createdAt: link.created_at } })
  }))

  // GET /:taskId/share — get share link info
  router.get('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    const { rows } = await db.query(
      'SELECT * FROM task_public_links WHERE task_id = $1',
      [taskId],
    )
    if (!rows[0]) throw new AppError(ErrorCode.TASK_SHARE_LINK_NOT_FOUND)

    const link = rows[0]
    res.json({ data: { id: link.id, taskId: link.task_id, token: link.token, isActive: link.is_active, expiresAt: link.expires_at, createdAt: link.created_at } })
  }))

  // DELETE /:taskId/share — deactivate share link
  router.delete('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    const { rowCount } = await db.query(
      'UPDATE task_public_links SET is_active = FALSE WHERE task_id = $1',
      [taskId],
    )
    if (!rowCount) throw new AppError(ErrorCode.TASK_SHARE_LINK_NOT_FOUND)

    res.status(204).end()
  }))

  return router
}

// GET /share/:token — PUBLIC (no auth)
export function publicShareHandler(db: Pool): RequestHandler {
  return asyncHandler(async (req, res): Promise<void> => {
    const { token } = req.params as { token: string }

    const { rows } = await db.query(
      `SELECT tpl.*, t.id AS t_id, t.title, t.description, t.status, t.priority,
              u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM task_public_links tpl
       JOIN tasks t ON t.id = tpl.task_id AND t.deleted_at IS NULL
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE tpl.token = $1 AND tpl.is_active = TRUE`,
      [token],
    )
    if (!rows[0]) throw new AppError(ErrorCode.TASK_SHARE_LINK_NOT_FOUND)

    const row = rows[0]

    // Check expiry if set
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      throw new AppError(ErrorCode.TASK_SHARE_LINK_EXPIRED)
    }

    res.json({
      data: {
        id: row.t_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee_name ? { name: row.assignee_name, avatarUrl: row.assignee_avatar } : null,
      },
    })
  })
}
