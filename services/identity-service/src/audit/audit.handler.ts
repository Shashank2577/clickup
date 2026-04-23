import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { AuditRepository } from './audit.repository.js'

// GET /workspaces/:workspaceId/audit-log
// Mounted at /workspaces/:workspaceId/audit-log with mergeParams: true from routes.ts
export function auditHandler(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new AuditRepository(db)

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      // Only workspace members can view audit log
      const memberCheck = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberCheck.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(memberCheck.rows[0].role)) {
        throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
      }

      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10))
      const rawPageSize = parseInt(String(req.query['pageSize'] ?? '50'), 10)
      const pageSize = Math.min(100, Math.max(1, isNaN(rawPageSize) ? 50 : rawPageSize))

      const filters = {
        actorId: req.query['actorId'] as string | undefined,
        resourceType: req.query['resourceType'] as string | undefined,
        from: req.query['from'] as string | undefined,
        to: req.query['to'] as string | undefined,
      }

      const result = await repository.getAuditLog(workspaceId, filters, page, pageSize)

      res.json({
        data: result.data.map((row) => ({
          id: row.id,
          workspaceId: row.workspace_id,
          actorId: row.actor_id,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          action: row.action,
          metadata: row.metadata,
          ipAddress: row.ip_address,
          createdAt: row.created_at,
        })),
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      })
    }),
  )

  return router
}
