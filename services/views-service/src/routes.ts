import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import { createViewsRepository } from './views/views.repository.js'
import { createViewHandlers } from './views/views.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()
  const repo = createViewsRepository(db)
  const handlers = createViewHandlers(repo, db)

  // Create a view
  router.post('/', requireAuth, handlers.createView)

  // List views for a list
  router.get('/list/:listId', requireAuth, handlers.listViewsByList)

  // List workspace-level views
  router.get('/workspace/:workspaceId', requireAuth, handlers.listViewsByWorkspace)

  // Per-view user state
  router.get('/:viewId/state', requireAuth, handlers.getUserState)
  router.patch('/:viewId/state', requireAuth, handlers.upsertUserState)

  // View query execution endpoints — must come before /:viewId to avoid conflicts
  router.get('/:viewId/tasks', requireAuth, handlers.getViewTasks)
  router.get('/:viewId/workload', requireAuth, handlers.getViewWorkload)

  // Single view CRUD — must come after /list and /workspace to avoid param conflicts
  router.get('/:viewId', requireAuth, handlers.getView)
  router.patch('/:viewId', requireAuth, handlers.updateView)
  router.delete('/:viewId', requireAuth, handlers.deleteView)

  return router
}
