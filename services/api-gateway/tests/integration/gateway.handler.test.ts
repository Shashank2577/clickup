import express from 'express'
import request from 'supertest'
import { makeTestToken } from '@clickup/test-helpers'
import { buildRouter } from '../../src/routes.js'
import { initRedis } from '../../src/middleware/rate-limiter.js'

// Point all upstream services at a local mock server started in beforeAll
const MOCK_PORT = 19001
let mockServer: ReturnType<typeof express.application.listen> | null = null

beforeAll(async () => {
  // Set env before importing gateway (proxy.config reads env at module load)
  process.env['IDENTITY_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['TASK_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['COMMENT_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['NOTIFICATION_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['REALTIME_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['AI_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['SEARCH_SERVICE_URL'] = `http://localhost:${MOCK_PORT}`
  process.env['REDIS_HOST'] = 'localhost'

  // Start a simple mock upstream that echoes the request path and headers
  const mock = express()
  mock.use((_req, res) => {
    res.json({ ok: true, path: _req.path, userId: _req.headers['x-user-id'] })
  })
  await new Promise<void>((resolve) => {
    mockServer = mock.listen(MOCK_PORT, resolve)
  })

  await initRedis()
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (mockServer) mockServer.close(() => resolve())
    else resolve()
  })
})

function buildApp() {
  const app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(buildRouter())
  return app
}

describe('GET /health', () => {
  it('returns 200 without auth', async () => {
    const app = buildApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('auth forwarding', () => {
  it('forwards x-user-id header to upstream for authenticated requests', async () => {
    const token = makeTestToken({
      userId: 'user-abc',
      email: 'test@example.com',
      role: 'member',
      workspaceId: 'ws-1',
    })
    const app = buildApp()
    const res = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-abc')
  })

  it('returns 401 for protected routes without token', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/v1/tasks')
    expect(res.status).toBe(401)
  })

  it('allows login without auth token', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'x' })
    // 200 from mock server (public route, auth skipped)
    expect(res.status).toBe(200)
  })
})

describe('route matching', () => {
  it('returns 404 for unmatched routes', async () => {
    const token = makeTestToken({ userId: 'u1', email: 'a@b.com', role: 'member', workspaceId: 'ws-1' })
    const app = buildApp()
    const res = await request(app)
      .get('/api/v1/unknown-service/something')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})
