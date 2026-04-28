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
import { TASK_EVENTS, COMMENT_EVENTS, WORKSPACE_EVENTS } from '@clickup/contracts'
import { createRouter } from './routes.js'
import { AutomationEngine } from './engine/engine.js'
import { startScheduler } from './scheduler/scheduler.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'automations-service'
const PORT = parseInt(process.env['PORT'] || '3007', 10)

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

  const engine = new AutomationEngine(db)

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

  startScheduler(db)
  logger.info('Automation scheduler started')

  // NATS Subscriptions for Automation Engine
  const TRIGGER_SUBJECTS = [
    TASK_EVENTS.CREATED,
    TASK_EVENTS.UPDATED,
    TASK_EVENTS.STATUS_CHANGED,
    TASK_EVENTS.ASSIGNED,
    TASK_EVENTS.COMPLETED,
    COMMENT_EVENTS.CREATED,
    WORKSPACE_EVENTS.MEMBER_ADDED,
    WORKSPACE_EVENTS.MEMBER_REMOVED,
  ]

  for (const subject of TRIGGER_SUBJECTS) {
    await subscribe(
      subject as any,
      async (payload: any) => {
        try {
          await engine.runAutomations(subject, payload)
        } catch (err) {
          logger.error({ err, subject }, 'Automation engine error')
          throw err
        }
      },
      { durable: 'automations-svc-' + (subject as string).replace(/\./g, '-') }
    )
    logger.info({ subject }, 'Subscribed to event for automation engine')
  }
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
