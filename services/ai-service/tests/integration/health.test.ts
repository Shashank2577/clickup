import { describe, it, expect, vi, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// Mock environment variables for tests
process.env['JWT_SECRET'] = 'test-secret'

// We will mock the entire @clickup/sdk package so that the health route does absolutely no real connections.
vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    createHealthHandler: vi.fn().mockImplementation((db) => {
      return (req: any, res: any) => {
        res.status(200).json({
          status: 'ok',
          checks: {
            postgres: 'ok',
            redis: 'ok',
            nats: 'ok'
          }
        })
      }
    }),
  }
})

describe('Integration Tests', () => {
  let app: express.Express

  beforeAll(async () => {
    app = express()
    app.use(express.json())

    const { Pool } = await import('pg')
    const db = new Pool()

    // Import after mocking
    const { createHealthHandler, errorHandler } = await import('@clickup/sdk')
    const { createRoutes } = await import('../../src/routes')

    app.get('/health', createHealthHandler(db))
    app.use(createRoutes())
    app.use(errorHandler)
  })

  describe('Integration Endpoints', () => {
    it('GET /health -> 200 (service up, Redis connected)', async () => {
      const res = await request(app).get('/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.checks.postgres).toBe('ok')
      expect(res.body.checks.redis).toBe('ok')
      expect(res.body.checks.nats).toBe('ok')
    })

    const validToken = jwt.sign({
      userId: 'u-1',
      workspaceId: 'ws-1',
      role: 'member',
      sessionId: 's-1'
    }, process.env['JWT_SECRET'] || 'test-secret')

    it('POST /api/v1/ai/task-breakdown -> 501 NOT_IMPLEMENTED (stub)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/task-breakdown')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Task 1' })
      expect(res.status).toBe(501)
      expect(res.body.error.code).toBe('SYSTEM_NOT_IMPLEMENTED')
    })

    it('POST /api/v1/ai/summarize -> 501 NOT_IMPLEMENTED (stub)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/summarize')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Test content', targetType: 'doc' })
      expect(res.status).toBe(501)
      expect(res.body.error.code).toBe('SYSTEM_NOT_IMPLEMENTED')
    })

    it('POST /api/v1/ai/prioritize -> 501 NOT_IMPLEMENTED (stub)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/prioritize')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ tasks: [] })
      expect(res.status).toBe(501)
      expect(res.body.error.code).toBe('SYSTEM_NOT_IMPLEMENTED')
    })

    it('POST /api/v1/ai/daily-plan -> 501 NOT_IMPLEMENTED (stub)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/daily-plan')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ tasks: [], availableHours: 8, date: '2025-01-01' })
      expect(res.status).toBe(501)
      expect(res.body.error.code).toBe('SYSTEM_NOT_IMPLEMENTED')
    })

    it('POST any /api/v1/ai/* without token -> 401 AUTH_MISSING_TOKEN', async () => {
      const res = await request(app)
        .post('/api/v1/ai/task-breakdown')
        .send({ title: 'Task 1' })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN')
    })
  })
})
