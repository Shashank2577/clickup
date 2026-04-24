import { Router } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

function toPermissionDto(row: any) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    role: row.role,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
  }
}

// Mounted at /:taskId/permissions (mergeParams: true)
export function taskPermissionsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new TasksRepository(db)

  // GET /:taskId/permissions — list who has explicit access
  router.get('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const { rows } = await db.query(
      'SELECT tp.*, u.name AS user_name, u.avatar_url AS user_avatar FROM task_permissions tp JOIN users u ON u.id = tp.user_id WHERE tp.task_id = $1 ORDER BY tp.created_at ASC',
      [taskId],
    )

    res.json({
      data: rows.map((row: any) => ({
        ...toPermissionDto(row),
        userName: row.user_name,
        userAvatar: row.user_avatar,
      })),
    })
  }))

  // POST /:taskId/permissions — grant access
  router.post('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }
    const { userId, role } = req.body as { userId: string; role: string }

    if (!userId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'userId is required')
    }

    const validRoles = ['viewer', 'editor']
    if (!role || !validRoles.includes(role)) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'role must be viewer or editor')
    }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const id = randomUUID()
    const { rows } = await db.query(
      `INSERT INTO task_permissions (id, task_id, user_id, role, granted_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (task_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [id, taskId, userId, role, req.auth.userId],
    )

    res.status(201).json({ data: toPermissionDto(rows[0]) })
  }))

  // DELETE /:taskId/permissions/:userId — revoke access
  router.delete('/:userId', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId, userId } = req.params as { taskId: string; userId: string }

    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const { rowCount } = await db.query(
      'DELETE FROM task_permissions WHERE task_id = $1 AND user_id = $2',
      [taskId, userId],
    )

    if (rowCount === 0) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION, 'No permission entry found for this user')
    }

    res.status(204).end()
  }))

  return router
}
