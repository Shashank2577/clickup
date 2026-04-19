import type { Express } from 'express'
import supertest from 'supertest'
import { makeTestToken, type TestAuthContext } from './auth.js'

export function createTestRequest(app: Express): {
  get: (path: string) => AuthedRequest
  post: (path: string) => AuthedRequest
  patch: (path: string) => AuthedRequest
  put: (path: string) => AuthedRequest
  delete: (path: string) => AuthedRequest
} {
  const agent = supertest(app)
  return {
    get: (path: string) => new AuthedRequest(agent.get(path)),
    post: (path: string) => new AuthedRequest(agent.post(path)),
    patch: (path: string) => new AuthedRequest(agent.patch(path)),
    put: (path: string) => new AuthedRequest(agent.put(path)),
    delete: (path: string) => new AuthedRequest(agent.delete(path)),
  }
}

class AuthedRequest {
  constructor(private req: supertest.Test) {}

  asUser(ctx: TestAuthContext): supertest.Test {
    const token = makeTestToken(ctx)
    return this.req
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .set('x-trace-id', 'test-trace-id')
  }

  unauthenticated(): supertest.Test {
    return this.req
      .set('Content-Type', 'application/json')
      .set('x-trace-id', 'test-trace-id')
  }

  raw(): supertest.Test {
    return this.req
  }
}
