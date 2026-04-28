import express from 'express'
import { httpLogger, correlationId, errorHandler, logger,
  injectGatewayAuth
} from '@clickup/sdk'
import { getRedis } from '@clickup/sdk'
import { routes } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'ai-service'
const PORT = parseInt(process.env['PORT'] ?? '3006', 10)

async function bootstrap(): Promise<void> {
  const redis = getRedis()
  await redis.ping()

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.use(injectGatewayAuth)

  app.get('/health', async (_req, res) => {
    try {
      await redis.ping()
      res.json({ status: 'ok', service: SERVICE_NAME, redis: 'ok' })
    } catch {
      res.status(503).json({ status: 'degraded', service: SERVICE_NAME, redis: 'error' })
    }
  })

  app.use('/', routes())
  app.use(errorHandler)

  app.listen(PORT, () => logger.info(`${SERVICE_NAME} listening on :${PORT}`))
}

bootstrap().catch(err => { console.error(err); process.exit(1) })
