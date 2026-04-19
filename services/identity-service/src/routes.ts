import { Router } from 'express'
import type { Pool } from 'pg'
import { authRoutes } from './auth/auth.handler.js'
import { usersRoutes } from './users/users.handler.js'
import { workspacesRoutes } from './workspaces/workspaces.handler.js'
import { workspaceSpacesRoutes, spacesRoutes } from './spaces/spaces.handler.js'
import { spaceListsRoutes, listsRoutes } from './lists/lists.handler.js'

export function routes(db: Pool): Router {
  const router = Router()
  router.use('/auth', authRoutes(db))
  router.use('/users', usersRoutes(db))
  // More-specific prefix mounts must come before less-specific ones
  router.use('/workspaces/:workspaceId/spaces', workspaceSpacesRoutes(db))
  router.use('/workspaces', workspacesRoutes(db))
  router.use('/spaces/:spaceId/lists', spaceListsRoutes(db))
  router.use('/spaces', spacesRoutes(db))
  router.use('/lists', listsRoutes(db))
  return router
}
