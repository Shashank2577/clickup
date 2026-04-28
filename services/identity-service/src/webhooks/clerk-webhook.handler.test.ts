import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Pool } from 'pg'
import type { Request, Response } from 'express'

// Shared verify mock so all Webhook instances share the same spy
const mockVerify = vi.fn()

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}))

import { Webhook } from 'svix'
import { clerkWebhookRoutes } from './clerk-webhook.handler'

const mockDb = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
} as unknown as Pool

function makeReq(body: object, headers: Record<string, string> = {}): Request {
  return {
    headers: {
      'svix-id': 'msg_test',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,sig',
      ...headers,
    },
    body: Buffer.from(JSON.stringify(body)),
  } as unknown as Request
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() }
  return res as any
}

describe('Clerk webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-establish the default mockResolvedValue after clearAllMocks
    ;(mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] })
    process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('upserts user on user.created event', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: 'user_clerk_1',
        email_addresses: [{ email_address: 'test@example.com', id: 'em_1' }],
        primary_email_address_id: 'em_1',
        first_name: 'Alice',
        last_name: 'Smith',
      },
    }
    mockVerify.mockReturnValueOnce(payload)

    const router = clerkWebhookRoutes(mockDb)
    const handler = (router as any).stack[0].route.stack[0].handle
    const req = makeReq(payload)
    const res = makeRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['user_clerk_1', 'test@example.com']),
    )
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('returns 400 on invalid svix signature', async () => {
    mockVerify.mockImplementationOnce(() => { throw new Error('Invalid signature') })

    const router = clerkWebhookRoutes(mockDb)
    const handler = (router as any).stack[0].route.stack[0].handle
    const req = makeReq({})
    const res = makeRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
