import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    authenticateRequest: vi.fn(),
  })),
}))

import { createClerkClient } from '@clerk/backend'
import { clerkAuth } from './clerk-auth'

const mockClerk = vi.mocked(createClerkClient)

function makeReq(overrides?: Partial<Request>): Request {
  return { headers: {}, ...overrides } as unknown as Request
}
function makeRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
}

describe('clerkAuth', () => {
  it('sets x-user-id and x-org-id headers when session is valid', async () => {
    const instance = mockClerk.mock.results[0]?.value ?? { authenticateRequest: vi.fn() }
    vi.mocked(instance.authenticateRequest).mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({ userId: 'user_abc', orgId: 'org_xyz', sessionId: 'sess_1' }),
    } as any)

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(req.headers['x-user-id']).toBe('user_abc')
    expect(req.headers['x-org-id']).toBe('org_xyz')
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 401 when session is not signed in', async () => {
    const instance = mockClerk.mock.results[0]?.value ?? { authenticateRequest: vi.fn() }
    vi.mocked(instance.authenticateRequest).mockResolvedValueOnce({
      isSignedIn: false,
      toAuth: () => null,
    } as any)

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
