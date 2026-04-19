import { Router } from 'express'
import type { Pool } from 'pg'
import { authRoutes } from './auth/auth.handler.js'
import { usersRoutes } from './users/users.handler.js'

export function routes(db: Pool): Router {
  const router = Router()
  router.use('/auth', authRoutes(db))
  router.use('/users', usersRoutes(db))
  return router
}
