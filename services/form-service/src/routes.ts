import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import { createFormsRepository } from './forms/forms.repository.js'
import { createFormsHandlers } from './forms/forms.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()
  const repo = createFormsRepository(db)
  const handlers = createFormsHandlers(repo)

  // Form CRUD
  router.post('/', requireAuth, handlers.createForm)
  router.get('/', requireAuth, handlers.listForms)
  router.get('/:id', requireAuth, handlers.getForm)
  router.patch('/:id', requireAuth, handlers.updateForm)
  router.delete('/:id', requireAuth, handlers.deleteForm)

  // Form responses — submit does NOT require auth (public form)
  router.post('/:id/responses', handlers.submitResponse)
  router.get('/:id/responses', requireAuth, handlers.listResponses)

  return router
}
