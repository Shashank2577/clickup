import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock getRedis to avoid real Redis connection in integration tests
const mockPing = vi.fn()

vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clickup/sdk')>()
  return {
    ...actual,
    getRedis: () => ({
      ping: mockPing,
    }),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

import { errorHandler, correlationId, httpLogger } from '@clickup/sdk'
import { routes } from '../../src/routes.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use(correlationId)

  // Health check matching index.ts pattern
  app.get('/health', async (_req, res) => {
    try {
      await mockPing()
      res.json({ status: 'ok', service: 'ai-service', redis: 'ok' })
    } catch {
      res.status(503).json({ status: 'degraded', service: 'ai-service', redis: 'error' })
    }
  })

  app.use('/', routes())
  app.use(errorHandler)
  return app
}

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = 'test-secret'
  })

  it('returns 200 with ok status when Redis is healthy', async () => {
    mockPing.mockResolvedValueOnce('PONG')
    const app = buildApp()
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.redis).toBe('ok')
    expect(res.body.service).toBe('ai-service')
  })

  it('returns 503 when Redis is down', async () => {
    mockPing.mockRejectedValueOnce(new Error('Connection refused'))
    const app = buildApp()
    const res = await request(app).get('/health')

    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.redis).toBe('error')
  })
})

describe('AI capability stubs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = 'test-secret'
  })

  it('POST /api/v1/ai/task-breakdown → 401 AUTH_MISSING_TOKEN (no token)', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/ai/task-breakdown')
      .send({ title: 'test' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN')
  })

  it('POST /api/v1/ai/summarize → 401 AUTH_MISSING_TOKEN (no token)', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/ai/summarize')
      .send({})

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN')
  })

  it('POST /api/v1/ai/prioritize → 401 AUTH_MISSING_TOKEN (no token)', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/ai/prioritize')
      .send({})

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN')
  })

  it('POST /api/v1/ai/daily-plan → 401 AUTH_MISSING_TOKEN (no token)', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/ai/daily-plan')
      .send({})

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN')
  })
})
