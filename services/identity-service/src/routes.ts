import { Router } from 'express'
import type { Pool } from 'pg'
import { authRoutes } from './auth/auth.handler.js'
import { usersRoutes } from './users/users.handler.js'
import { workspacesRoutes } from './workspaces/workspaces.handler.js'
import { workspaceSpacesRoutes, spacesRoutes } from './spaces/spaces.handler.js'
import { spaceListsRoutes, listsRoutes } from './lists/lists.handler.js'
import { favoritesRoutes } from './favorites/favorites.handler.js'
import { teamsRoutes } from './teams/teams.handler.js'
import { trashRoutes } from './trash/trash.handler.js'
import { sidebarRoutes } from './sidebar/sidebar.handler.js'
import { presenceRoutes } from './presence/presence.handler.js'
import { preferencesRoutes } from './preferences/preferences.handler.js'

export function routes(db: Pool): Router {
  const router = Router()
  router.use('/auth', authRoutes(db))

  // User routes — presence and preferences are mounted under /users
  router.use('/users', presenceRoutes(db))
  router.use('/users', preferencesRoutes(db))
  router.use('/users', usersRoutes(db))

  // More-specific prefix mounts must come before less-specific ones
  router.use('/workspaces/:workspaceId/spaces', workspaceSpacesRoutes(db))
  router.use('/workspaces', workspacesRoutes(db))
  router.use('/spaces/:spaceId/lists', spaceListsRoutes(db))
  router.use('/spaces', spacesRoutes(db))
  router.use('/lists', listsRoutes(db))

  // New feature routes
  router.use('/favorites', favoritesRoutes(db))
  router.use('/teams', teamsRoutes(db))
  router.use('/trash', trashRoutes(db))
  router.use('/sidebar', sidebarRoutes(db))
  return router
}
