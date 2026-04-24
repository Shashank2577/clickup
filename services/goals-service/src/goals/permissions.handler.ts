import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

export function goalPermissionsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /goals/:goalId/permissions — list who has access
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { goalId } = req.params
      const { rows } = await db.query(
        `SELECT gp.*, u.email, u.name as user_name
         FROM goal_permissions gp
         JOIN users u ON u.id = gp.user_id
         WHERE gp.goal_id = $1
         ORDER BY gp.created_at`,
        [goalId],
      )
      res.json({ data: rows })
    }),
  )

  // POST /goals/:goalId/permissions — grant access to a user
  // body: { userId: string, role: 'viewer' | 'editor' | 'owner' }
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { goalId } = req.params
      const grantedBy = (req as any).auth!.userId
      const { userId, role = 'viewer' } = req.body as { userId: string; role?: string }

      if (!userId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'userId is required')
      if (!['viewer', 'editor', 'owner'].includes(role)) {
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_INPUT,
          'role must be viewer, editor, or owner',
        )
      }

      // Verify goal exists
      const { rows: goalRows } = await db.query('SELECT id FROM goals WHERE id = $1', [goalId])
      if (!goalRows[0]) throw new AppError(ErrorCode.GOAL_NOT_FOUND)

      const { rows } = await db.query(
        `INSERT INTO goal_permissions (id, goal_id, user_id, role, granted_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (goal_id, user_id) DO UPDATE SET role = $4
         RETURNING *`,
        [randomUUID(), goalId, userId, role, grantedBy],
      )

      res.status(201).json({ data: rows[0] })
    }),
  )

  // PATCH /goals/:goalId/permissions/:targetUserId — update role
  router.patch(
    '/:targetUserId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { goalId, targetUserId } = req.params
      const { role } = req.body as { role: string }

      if (!['viewer', 'editor', 'owner'].includes(role)) {
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_INPUT,
          'role must be viewer, editor, or owner',
        )
      }

      const { rows } = await db.query(
        `UPDATE goal_permissions SET role = $1 WHERE goal_id = $2 AND user_id = $3 RETURNING *`,
        [role, goalId, targetUserId],
      )
      if (!rows[0]) throw new AppError(ErrorCode.GOAL_NOT_FOUND, 'Permission not found')
      res.json({ data: rows[0] })
    }),
  )

  // DELETE /goals/:goalId/permissions/:targetUserId — revoke access
  router.delete(
    '/:targetUserId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { goalId, targetUserId } = req.params
      await db.query('DELETE FROM goal_permissions WHERE goal_id = $1 AND user_id = $2', [
        goalId,
        targetUserId,
      ])
      res.status(204).send()
    }),
  )

  // PATCH /goals/:goalId/permissions/privacy — toggle is_private
  router.patch(
    '/privacy',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { goalId } = req.params
      const { isPrivate } = req.body as { isPrivate: boolean }
      const { rows } = await db.query(
        'UPDATE goals SET is_private = $1 WHERE id = $2 RETURNING *',
        [isPrivate, goalId],
      )
      if (!rows[0]) throw new AppError(ErrorCode.GOAL_NOT_FOUND)
      res.json({ data: rows[0] })
    }),
  )

  return router
}
