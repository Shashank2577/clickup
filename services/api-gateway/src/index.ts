import express from 'express'
import { httpLogger, correlationId, errorHandler } from '@clickup/sdk'
import { buildRouter } from './routes.js'
import { initRedis } from './middleware/rate-limiter.js'
import { createWsServer } from './websocket/ws.server.js'

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
  // Aggregate health — lists all upstream services
  app.get('/health/services', (_req, res) => {
    res.json({
      status: 'ok',
      service: SERVICE_NAME,
      upstreams: {
        identity:      process.env['IDENTITY_SERVICE_URL'],
        task:          process.env['TASK_SERVICE_URL'],
        comment:       process.env['COMMENT_SERVICE_URL'],
        notification:  process.env['NOTIFICATION_SERVICE_URL'],
        ai:            process.env['AI_SERVICE_URL'],
        file:          process.env['FILE_SERVICE_URL'],
        search:        process.env['SEARCH_SERVICE_URL'],
        docs:          process.env['DOCS_SERVICE_URL'],
        automations:   process.env['AUTOMATIONS_SERVICE_URL'],
        goals:         process.env['GOAL_SERVICE_URL'],
      },
    })
  })

  // All proxied routes
  app.use(buildRouter())

  // Error handler — MUST be last
  app.use(errorHandler)

  const server = app.listen(PORT, () => {
    console.warn(`${SERVICE_NAME} listening on :${PORT}`)
  })
  createWsServer(server)
}

bootstrap().catch((err) => {
  console.error('Failed to start api-gateway:', err)
  process.exit(1)
})
