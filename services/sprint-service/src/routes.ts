import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import {
  createSprintHandler,
  listSprintsHandler,
  getSprintHandler,
  updateSprintHandler,
  deleteSprintHandler,
  startSprintHandler,
  completeSprintHandler,
  addSprintTasksHandler,
  removeSprintTaskHandler,
  getSprintStatsHandler,
} from './sprints/sprints.handler.js'
import { backlogHandler } from './sprints/backlog.handler.js'

export function routes(db: Pool): Router {
  const router = Router()

  // List-scoped routes
  router.post('/lists/:listId/sprints', requireAuth, createSprintHandler)
  router.get('/lists/:listId/sprints', requireAuth, listSprintsHandler)

  // Backlog — tasks in a list not in any active sprint
  router.get('/lists/:listId/backlog', requireAuth, backlogHandler(db))

  // Sprint-scoped routes
  router.get('/:sprintId', requireAuth, getSprintHandler)
  router.patch('/:sprintId', requireAuth, updateSprintHandler)
  router.delete('/:sprintId', requireAuth, deleteSprintHandler)

  // Sprint lifecycle
  router.post('/:sprintId/start', requireAuth, startSprintHandler)
  router.post('/:sprintId/complete', requireAuth, completeSprintHandler)

  // Sprint tasks
  router.post('/:sprintId/tasks', requireAuth, addSprintTasksHandler)
  router.delete('/:sprintId/tasks/:taskId', requireAuth, removeSprintTaskHandler)

  // Stats
  router.get('/:sprintId/stats', requireAuth, getSprintStatsHandler)

  return router
}
