import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import {
  createCommentHandler,
  listCommentsHandler,
  updateCommentHandler,
  deleteCommentHandler,
  resolveCommentHandler,
  addReactionHandler,
  removeReactionHandler,
  createReplyHandler,
  getRepliesHandler,
} from './comments/comments.handler.js'
import { commentAssignmentsRouter, myAssignedCommentsHandler } from './comments/assignments.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  router.post('/tasks/:taskId/comments', requireAuth, createCommentHandler(db))
  router.get('/tasks/:taskId/comments', requireAuth, listCommentsHandler(db))

  // My assigned comments — must come before /:commentId routes to avoid conflict
  router.get('/me/assigned-comments', requireAuth, myAssignedCommentsHandler(db))

  router.patch('/:commentId', requireAuth, updateCommentHandler(db))
  router.delete('/:commentId', requireAuth, deleteCommentHandler(db))
  router.post('/:commentId/resolve', requireAuth, resolveCommentHandler(db))

  router.post('/:commentId/reactions', requireAuth, addReactionHandler(db))
  router.delete('/:commentId/reactions/:emoji', requireAuth, removeReactionHandler(db))

  // Threaded replies
  router.post('/:commentId/replies', requireAuth, createReplyHandler(db))
  router.get('/:commentId/replies', requireAuth, getRepliesHandler(db))

  // Comment assignments (assign/unassign/resolve)
  router.use(commentAssignmentsRouter(db))

  return router
}
