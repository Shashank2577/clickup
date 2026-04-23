import express from 'express'
import { Pool } from 'pg'
import { httpLogger, correlationId, errorHandler, logger, createHealthHandler } from '@clickup/sdk'
import { createRouter } from './routes.js'
import { startNotificationSubscribers } from './notifications/notifications.subscriber.js'
import { startDigestRunner } from './notifications/digest.service.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'notification-service'
const PORT = parseInt(process.env['PORT'] || '3004', 10)

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

  await startNotificationSubscribers(db)
  logger.info('NATS subscribers started')

  startDigestRunner(db)
  logger.info('Digest runner scheduled')

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', createHealthHandler(db))
  app.use('/', createRouter(db))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
