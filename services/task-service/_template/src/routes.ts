import { Router } from 'express'
import type { Pool } from 'pg'

// ============================================================
// Register all routes for this service here.
// Import handlers from feature-specific files.
// ============================================================

export function routes(db: Pool): Router {
  const router = Router()

  // Example: router.use('/tasks', taskRoutes(db))

  return router
}
