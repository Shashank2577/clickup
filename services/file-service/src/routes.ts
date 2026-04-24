import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import { upload, uploadFile, getFile, deleteFile, listTaskFiles } from './files/files.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  router.post('/', requireAuth, upload.single('file'), uploadFile(db))
  // Specific routes before wildcard /:fileId
  router.get('/tasks/:taskId/files', requireAuth, listTaskFiles(db))
  router.get('/:fileId', requireAuth, getFile(db))
  router.delete('/:fileId', requireAuth, deleteFile(db))

  return router
}
