import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import { createAuditRepository } from './audit/audit.repository.js'
import { createAuditHandlers } from './audit/audit.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()
  const repo = createAuditRepository(db)
  const handlers = createAuditHandlers(repo)

  // POST /api/v1/audit-logs — record audit entry (requires auth)
  router.post('/', requireAuth, handlers.createAuditLog)

  // GET /api/v1/audit-logs — list audit logs with filters (requires auth)
  router.get('/', requireAuth, handlers.listAuditLogs)

  // GET /api/v1/audit-logs/:id — get single audit log detail (requires auth)
  router.get('/:id', requireAuth, handlers.getAuditLog)

  return router
}
