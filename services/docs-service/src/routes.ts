import { Router } from 'express'
import type { Pool } from 'pg'
import { DocsRepository } from './docs/docs.repository.js'
import { DocsService } from './docs/docs.service.js'
import { createDocsRouter } from './docs/docs.handler.js'

export function createRoutes(db: Pool): Router {
  const router = Router()
  const repo = new DocsRepository(db)
  const service = new DocsService(repo)
  router.use('/api/v1', createDocsRouter(service))
  return router
}
