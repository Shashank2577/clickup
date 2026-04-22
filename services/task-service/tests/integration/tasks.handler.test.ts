import express from 'express'
import request from 'supertest'
import { withRollback, getTestDb, makeTestToken } from '@clickup/test-helpers'
import { errorHandler, correlationId } from '@clickup/sdk'
import { createRoutes } from '../../src/routes.js'

function buildApp() {
  const db = getTestDb()
  const app = express()
  app.use(express.json())
  app.use(correlationId)
  app.use('/api/v1', createRoutes(db))
  app.use(errorHandler)
  return app
}

describe('Task Service Integration', () => {
  it('GET /api/v1/tasks/:taskId - returns 401 without token', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/v1/tasks/uuid')
    expect(res.status).toBe(401)
  })

  // More tests would go here, mocking identity-service responses
})
