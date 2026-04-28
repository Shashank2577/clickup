import express from 'express'
import { Pool } from 'pg'
import { 
  httpLogger, 
  correlationId, 
  errorHandler, 
  logger, 
  createHealthHandler,
  subscribe,
  injectGatewayAuth
} from '@clickup/sdk'
import { TASK_EVENTS } from '@clickup/contracts'
import { createRouter } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'comment-service'
const PORT = parseInt(process.env['PORT'] || '3003', 10)

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

  // NATS Subscriptions
  await subscribe(
    TASK_EVENTS.DELETED as any,
    async (payload: any) => {
      try {
        await db.query(
          'UPDATE comments SET deleted_at = NOW() WHERE task_id = $1 AND deleted_at IS NULL',
          [payload.taskId]
        )
        logger.info({ taskId: payload.taskId }, 'Soft-deleted comments for deleted task')
      } catch (err) {
        logger.error({ err, taskId: payload.taskId }, 'Failed to soft-delete comments for task')
        throw err
      }
    },
    { durable: 'comment-svc-task-deleted' }
  )
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
