import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateFavoriteSchema } from '@clickup/contracts'

// Re-use CreateFavoriteSchema — same shape: { itemType, itemId, itemName }
const UpsertRecentlyViewedSchema = CreateFavoriteSchema

interface RecentlyViewedRow {
  id: string
  user_id: string
  workspace_id: string
  item_type: string
  item_id: string
  item_name: string
  viewed_at: Date
}

function toDto(row: RecentlyViewedRow) {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    viewedAt: row.viewed_at.toISOString(),
  }
}

// Mounted at: /workspaces/:workspaceId/recently-viewed
export function recentlyViewedRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/recently-viewed
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const r = await db.query<RecentlyViewedRow>(
        `SELECT id, user_id, workspace_id, item_type, item_id, item_name, viewed_at
         FROM recently_viewed
         WHERE user_id = $1 AND workspace_id = $2
         ORDER BY viewed_at DESC
         LIMIT 20`,
        [req.auth.userId, workspaceId],
      )
      res.json({ data: r.rows.map(toDto) })
    }),
  )

  // POST /workspaces/:workspaceId/recently-viewed
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const input = validate(UpsertRecentlyViewedSchema, req.body)

      const r = await db.query<RecentlyViewedRow>(
        `INSERT INTO recently_viewed (user_id, workspace_id, item_type, item_id, item_name, viewed_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, item_type, item_id)
         DO UPDATE SET viewed_at = NOW(), item_name = EXCLUDED.item_name
         RETURNING id, user_id, workspace_id, item_type, item_id, item_name, viewed_at`,
        [req.auth.userId, workspaceId, input.itemType, input.itemId, input.itemName],
      )
      res.json({ data: toDto(r.rows[0]!) })
    }),
  )

  return router
}
