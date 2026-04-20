import { Router } from 'express'
import { asyncHandler, requireAuth } from '@clickup/sdk'

export function createRoutes(): Router {
  const router = Router()

  // AI capability stubs — implemented in WO-026/027/028
  // These return 501 until the capability WO is implemented
  const notImplemented = asyncHandler(async (_req, res) => {
    res.status(501).json({ error: { code: 'SYSTEM_NOT_IMPLEMENTED', message: 'AI capability not yet implemented', status: 501 } })
  })

  // We should apply requireAuth here per the WO integration test requirement
  // "POST any /ai/* without token -> 401 AUTH_MISSING_TOKEN"
  router.use('/api/v1/ai', requireAuth)

  router.post('/api/v1/ai/task-breakdown', notImplemented)
  router.post('/api/v1/ai/summarize', notImplemented)
  router.post('/api/v1/ai/prioritize', notImplemented)
  router.post('/api/v1/ai/daily-plan', notImplemented)

  return router
}
