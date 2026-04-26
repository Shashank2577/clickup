import express from 'express'
import { Pool } from 'pg'
import {
  httpLogger,
  correlationId,
  errorHandler,
  logger,
  createHealthHandler,
} from '@clickup/sdk'
import { createRouter } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'chat-service'
const PORT = parseInt(process.env['PORT'] || '3021', 10)

const db = new Pool({
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  database: process.env['POSTGRES_DB'] || 'clickup',
  user: process.env['POSTGRES_USER'] || 'clickup',
  password: process.env['POSTGRES_PASSWORD'] || 'clickup_dev',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')
  logger.info('Connected to PostgreSQL')

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
