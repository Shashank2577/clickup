import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler } from '@clickup/sdk'
import {
  createDocHandler,
  getDocHandler,
  updateDocHandler,
  deleteDocHandler,
  getSharedDocHandler,
  listDocPermissionsHandler,
  grantDocPermissionHandler,
  revokeDocPermissionHandler,
  createShareLinkHandler,
  deleteShareLinkHandler,
  listDocVersionsHandler,
  getDocVersionHandler,
  restoreDocVersionHandler,
} from './docs/docs.handler.js'
import { templatesRouter } from './docs/templates.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  // ============================================================
  // Public routes (no auth required)
  // ============================================================

  // Public share-link access
  router.get('/shared/:token', getSharedDocHandler(db))

  // ============================================================
  // Templates (must come before /:docId to avoid param conflicts)
  // ============================================================
  router.use('/templates', requireAuth, templatesRouter(db))

  // ============================================================
  // Authenticated routes
  // ============================================================

  // List docs for a workspace
  router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query['workspaceId'] as string
    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId query param required' })
      return
    }
    const { rows } = await db.query(
      `SELECT id, workspace_id AS "workspaceId", title, parent_id AS "parentId",
              is_public AS "isPublic", created_by AS "createdBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM docs
       WHERE workspace_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [workspaceId]
    )
    res.json({ data: rows })
  }))

  // Base prefix is already stripped by the API Gateway
  router.post('/', requireAuth, createDocHandler(db))

  // Permissions
  router.get('/:docId/permissions', requireAuth, listDocPermissionsHandler(db))
  router.post('/:docId/permissions', requireAuth, grantDocPermissionHandler(db))
  router.delete('/:docId/permissions/:userId', requireAuth, revokeDocPermissionHandler(db))

  // Share links
  router.post('/:docId/share', requireAuth, createShareLinkHandler(db))
  router.delete('/:docId/share', requireAuth, deleteShareLinkHandler(db))

  // Version history
  router.get('/:docId/versions', requireAuth, listDocVersionsHandler(db))
  router.get('/:docId/versions/:versionId', requireAuth, getDocVersionHandler(db))
  router.post('/:docId/versions/:versionId/restore', requireAuth, restoreDocVersionHandler(db))

  // Core CRUD — must come after sub-routes to avoid param conflicts
  router.get('/:docId', requireAuth, getDocHandler(db))
  router.patch('/:docId', requireAuth, updateDocHandler(db))
  router.delete('/:docId', requireAuth, deleteDocHandler(db))

  return router
}
