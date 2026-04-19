import { Router } from 'express'
import type { Pool } from 'pg'
import { authRoutes } from './auth/auth.handler.js'
import { workspaceSpacesRoutes, spacesRoutes } from './spaces/spaces.handler.js'
import { spaceListsRoutes, listsRoutes } from './lists/lists.handler.js'

export function routes(db: Pool): Router {
  const router = Router()
  router.use('/auth', authRoutes(db))
  router.use('/workspaces/:workspaceId/spaces', workspaceSpacesRoutes(db))
  router.use('/spaces', spacesRoutes(db))
  router.use('/spaces/:spaceId/lists', spaceListsRoutes(db))
  router.use('/lists', listsRoutes(db))
  return router
}
