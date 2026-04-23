import { Router } from 'express'
import {
  createGoalHandler,
  getGoalHandler,
  getGoalsForWorkspaceHandler,
  updateGoalHandler,
  deleteGoalHandler,
  addTargetHandler,
  updateTargetHandler,
} from './goals/goals.handler.js'
import { goalFoldersRouter } from './goal-folders/goal-folders.handler.js'
import { requireAuth } from '@clickup/sdk'
import type { Pool } from 'pg'

export function routes(db: Pool): Router {
  const router = Router()

  router.post('/', requireAuth, createGoalHandler)
  router.get('/workspace/:workspaceId', requireAuth, getGoalsForWorkspaceHandler)
  router.get('/:goalId', requireAuth, getGoalHandler)
  router.patch('/:goalId', requireAuth, updateGoalHandler)
  router.delete('/:goalId', requireAuth, deleteGoalHandler)

  router.post('/:goalId/targets', requireAuth, addTargetHandler)
  router.patch('/:goalId/targets/:targetId', requireAuth, updateTargetHandler)

  // Goal folders
  router.use(goalFoldersRouter(db))

  return router
}
