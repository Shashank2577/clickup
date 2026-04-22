import { Router } from 'express'
import { Pool } from 'pg'
import {
  createGoalHandler,
  getGoalHandler,
  getGoalsForWorkspaceHandler,
  updateGoalHandler,
  deleteGoalHandler,
  addTargetHandler,
  updateTargetHandler,
} from './goals/goals.handler.js'

export function routes(db: Pool): Router {
  const router = Router()

  router.post('/api/v1/workspaces/:workspaceId/goals', createGoalHandler)
  router.get('/api/v1/workspaces/:workspaceId/goals', getGoalsForWorkspaceHandler)
  router.get('/api/v1/goals/:goalId', getGoalHandler)
  router.patch('/api/v1/goals/:goalId', updateGoalHandler)
  router.delete('/api/v1/goals/:goalId', deleteGoalHandler)

  router.post('/api/v1/goals/:goalId/targets', addTargetHandler)
  router.patch('/api/v1/goals/:goalId/targets/:targetId', updateTargetHandler)

  return router
}
