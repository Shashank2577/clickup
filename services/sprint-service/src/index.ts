import express from 'express'
import { httpLogger, correlationId, errorHandler, logger } from '@clickup/sdk'
import { db } from './sprints/sprints.repository.js'
import { routes } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'sprint-service'
const PORT = parseInt(process.env['PORT'] ?? '3013', 10)

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/', routes(db))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err)
  process.exit(1)
})
