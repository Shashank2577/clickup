import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

const mockAuthenticateRequest = vi.fn()

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({ authenticateRequest: mockAuthenticateRequest })),
}))

import { clerkAuth } from './clerk-auth'

function makeReq(overrides?: Partial<Request>): Request {
  return { headers: {}, ...overrides } as unknown as Request
}
function makeRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
}

describe('clerkAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets x-user-id, x-org-id, and x-session-id headers when session is valid', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({ userId: 'user_abc', orgId: 'org_xyz', sessionId: 'sess_1' }),
    })

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(req.headers['x-user-id']).toBe('user_abc')
    expect(req.headers['x-org-id']).toBe('org_xyz')
    expect(req.headers['x-session-id']).toBe('sess_1')
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 401 when session is not signed in', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({
      isSignedIn: false,
      toAuth: () => null,
    })

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
