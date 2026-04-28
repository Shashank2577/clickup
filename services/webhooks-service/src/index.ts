import express from 'express'
import { Pool } from 'pg'
import {
  httpLogger,
  correlationId,
  errorHandler,
  logger,
  createHealthHandler,
  injectGatewayAuth
} from '@clickup/sdk'
import { createRouter } from './routes.js'
import { startWebhookDeliverer } from './webhooks/webhooks.deliverer.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'webhooks-service'
const PORT = parseInt(process.env['PORT'] || '3012', 10)

const db = new Pool({
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  database: process.env['POSTGRES_DB'] || 'clickup',
  user: process.env['POSTGRES_USER'] || 'clickup',
  password: process.env['POSTGRES_PASSWORD'] || 'clickup_dev',
})

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')
  logger.info('Connected to PostgreSQL')

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.use(injectGatewayAuth)

  app.get('/health', createHealthHandler(db))
  app.use('/', createRouter(db))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })

  // Start NATS-based webhook deliverer
  await startWebhookDeliverer(db)
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
