import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { makeTestToken } from '@clickup/test-helpers'
import { buildRouter } from '../../src/routes.js'
import { initRedis } from '../../src/middleware/rate-limiter.js'

// Mock Clerk so integration tests don't need real Clerk credentials.
// The mock reads the JWT from the Authorization header (signed with JWT_SECRET)
// and returns a valid auth state, simulating what Clerk would do.
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    authenticateRequest: vi.fn((req: any) => {
      const authHeader: string | undefined = req.headers?.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return Promise.resolve({ isSignedIn: false, toAuth: () => null })
      }
      const token = authHeader.slice(7)
      const secret = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-in-production'
      try {
        const payload = jwt.verify(token, secret) as { userId: string; workspaceId?: string; sessionId?: string }
        return Promise.resolve({
          isSignedIn: true,
          toAuth: () => ({ userId: payload.userId, orgId: payload.workspaceId, sessionId: payload.sessionId ?? 'test-session' }),
        })
      } catch {
        return Promise.resolve({ isSignedIn: false, toAuth: () => null })
      }
    }),
  })),
}))

// Point all upstream services at a local mock server started in beforeAll
const MOCK_PORT = 19001
let mockServer: ReturnType<typeof express.application.listen> | null = null

beforeAll(async () => {
  // Set env before importing gateway (proxy.config reads env at module load)
  const MOCK = `http://localhost:${MOCK_PORT}`
  process.env['IDENTITY_SERVICE_URL']     = MOCK
  process.env['TASK_SERVICE_URL']         = MOCK
  process.env['COMMENT_SERVICE_URL']      = MOCK
  process.env['NOTIFICATION_SERVICE_URL'] = MOCK
  process.env['REALTIME_SERVICE_URL']     = MOCK
  process.env['AI_SERVICE_URL']           = MOCK
  process.env['SEARCH_SERVICE_URL']       = MOCK
  process.env['FILE_SERVICE_URL']         = MOCK
  process.env['GOAL_SERVICE_URL']         = MOCK
  process.env['DOCS_SERVICE_URL']         = MOCK
  process.env['AUTOMATIONS_SERVICE_URL']  = MOCK
  process.env['VIEWS_SERVICE_URL']        = MOCK
  process.env['WEBHOOKS_SERVICE_URL']     = MOCK
  process.env['DASHBOARD_SERVICE_URL']    = MOCK
  process.env['SPRINT_SERVICE_URL']       = MOCK
  process.env['SLACK_SERVICE_URL']        = MOCK
  process.env['GITHUB_SERVICE_URL']       = MOCK
  process.env['GITLAB_SERVICE_URL']       = MOCK
  process.env['CHAT_SERVICE_URL']         = MOCK
  process.env['AUDIT_SERVICE_URL']        = MOCK
  process.env['REDIS_HOST'] = 'localhost'
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-in-production'

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

  it('allows webhook without auth token (public route)', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/v1/auth/webhooks/clerk').send({ type: 'user.created' })
    // 200 from mock server (public route, auth skipped)
    expect(res.status).toBe(200)
  })
})

describe('route matching', () => {
  it('returns 404 for unmatched routes', async () => {
    const token = makeTestToken({ userId: 'u1', workspaceId: 'ws-1' })
    const app = buildApp()
    const res = await request(app)
      .get('/api/v1/unknown-service/something')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})
