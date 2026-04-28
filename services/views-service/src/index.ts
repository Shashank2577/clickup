import express from 'express'
import { Pool } from 'pg'
import { httpLogger, correlationId, errorHandler, logger,
  injectGatewayAuth
} from '@clickup/sdk'
import { createRouter } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'views-service'
const PORT = parseInt(process.env['PORT'] ?? '3011', 10)

const db = new Pool({
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  database: process.env['POSTGRES_DB'] ?? 'clickup',
  user: process.env['POSTGRES_USER'] ?? 'clickup',
  password: process.env['POSTGRES_PASSWORD'] ?? 'clickup_dev',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.use(injectGatewayAuth)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/', createRouter(db))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err)
  process.exit(1)
})
