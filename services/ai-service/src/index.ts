// ============================================================
// Service Bootstrap Template
// Copy this entire _template directory to create a new service.
// Replace SERVICE_NAME with the actual service name.
// ============================================================

import express from 'express'
import { Pool } from 'pg'
import { httpLogger, correlationId, errorHandler, createHealthHandler } from '@clickup/sdk'
import { createRoutes } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'unknown-service'
const PORT = parseInt(process.env['PORT'] ?? '3000', 10)

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
  // Verify DB connection on startup
  await db.query('SELECT 1')

  const app = express()

  // Middleware — ORDER MATTERS, do not reorder
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  // Health check — no auth required
  app.get('/health', createHealthHandler(db))

  // Service routes
  app.use(createRoutes())

  // Error handler — MUST be last
  app.use(errorHandler)

  app.listen(PORT, () => {
    console.warn(`${SERVICE_NAME} listening on :${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start service:', err)
  process.exit(1)
})
