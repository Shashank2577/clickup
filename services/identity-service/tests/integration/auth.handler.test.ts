import express from 'express'
import request from 'supertest'
import { withRollback, createTestUser, getTestDb } from '@clickup/test-helpers'
import { errorHandler, correlationId } from '@clickup/sdk'
import { routes } from '../../src/routes.js'

// Set required env vars for tests
process.env['JWT_SECRET'] = 'test-secret-for-identity-tests'
process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_test'

function buildApp() {
  const db = getTestDb()
  const app = express()
  app.use(express.json())
  app.use(correlationId)
  app.use('/api/v1', routes(db))
  app.use(errorHandler)
  return app
}

describe('POST /api/v1/auth/register', () => {
  it('creates user and returns JWT', async () => {
    await withRollback(async () => {
      const app = buildApp()
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', password: 'SecurePass123!', name: 'Test User' })

      expect(res.status).toBe(201)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.user.email).toBe('new@test.com')
      expect(res.body.data.user).not.toHaveProperty('password_hash')
    })
  })

  it('returns USER_EMAIL_TAKEN when email exists', async () => {
    await withRollback(async (client) => {
      await createTestUser(client, { email: 'taken@test.com' })
      const app = buildApp()
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'taken@test.com', password: 'SecurePass123!', name: 'Test' })

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('USER_EMAIL_TAKEN')
    })
  })

  it('returns 422 on missing password', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', name: 'Test' })
    expect(res.status).toBe(422)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns JWT on valid credentials', async () => {
    await withRollback(async (client) => {
      const { email, password } = await createTestUser(client)
      const app = buildApp()
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })

      expect(res.status).toBe(200)
      expect(res.body.data.token).toBeDefined()
    })
  })

  it('returns AUTH_INVALID_CREDENTIALS on wrong password', async () => {
    await withRollback(async (client) => {
      const { email } = await createTestUser(client)
      const app = buildApp()
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
    })
  })

  it('returns same error for unknown email', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'pass' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 204', async () => {
    await withRollback(async (client) => {
      const { email, password } = await createTestUser(client)
      const app = buildApp()
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })
      const token = loginRes.body.data.token

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(204)
    })
  })
})

describe('GET /api/v1/auth/verify', () => {
  it('returns auth context for valid token', async () => {
    await withRollback(async (client) => {
      const { email, password } = await createTestUser(client)
      const app = buildApp()
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })
      const token = loginRes.body.data.token

      const res = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.userId).toBeDefined()
    })
  })

  it('returns 401 with no token', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/v1/auth/verify')
    expect(res.status).toBe(401)
  })
})
