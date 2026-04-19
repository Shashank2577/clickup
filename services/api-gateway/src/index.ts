import express from 'express'
import { httpLogger, correlationId, errorHandler } from '@clickup/sdk'
import { buildRouter } from './routes.js'
import { initRedis } from './middleware/rate-limiter.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'api-gateway'
const PORT = parseInt(process.env['PORT'] ?? '3000', 10)

async function bootstrap(): Promise<void> {
  await initRedis()

  const app = express()

  // Middleware — ORDER MATTERS, do not reorder
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '10mb' }))

  // Health check — no auth, no proxy
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: SERVICE_NAME })
  })

  // All proxied routes
  app.use(buildRouter())

  // Error handler — MUST be last
  app.use(errorHandler)

  app.listen(PORT, () => {
    console.warn(`${SERVICE_NAME} listening on :${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start api-gateway:', err)
  process.exit(1)
})
