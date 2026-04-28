import express from 'express'
import { httpLogger, correlationId, errorHandler, logger,
  injectGatewayAuth
} from '@clickup/sdk'
import { db } from './dashboards/dashboards.repository.js'
import { routes } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'dashboard-service'
const PORT = parseInt(process.env['PORT'] ?? '3014', 10)

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.use(injectGatewayAuth)

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: SERVICE_NAME }))
  app.use('/', routes())
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err)
  process.exit(1)
})
