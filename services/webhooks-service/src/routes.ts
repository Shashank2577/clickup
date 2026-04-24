import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import {
  createWebhookHandler,
  listWebhooksHandler,
  getWebhookHandler,
  updateWebhookHandler,
  deleteWebhookHandler,
  listDeliveriesHandler,
  testWebhookHandler,
} from './webhooks/webhooks.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  // Base prefix /api/v1/webhooks is stripped by the Gateway
  router.post('/', requireAuth, createWebhookHandler(db))
  router.get('/workspace/:workspaceId', requireAuth, listWebhooksHandler(db))
  router.get('/:webhookId', requireAuth, getWebhookHandler(db))
  router.patch('/:webhookId', requireAuth, updateWebhookHandler(db))
  router.delete('/:webhookId', requireAuth, deleteWebhookHandler(db))
  router.get('/:webhookId/deliveries', requireAuth, listDeliveriesHandler(db))
  router.post('/:webhookId/test', requireAuth, testWebhookHandler(db))

  return router
}
