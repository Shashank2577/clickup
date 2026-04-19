import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@clickup/contracts'

// Mock getRedis from @clickup/sdk
const mockIncr = vi.fn()
const mockExpire = vi.fn()
const mockIncrby = vi.fn()
const mockGet = vi.fn()

vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clickup/sdk')>()
  return {
    ...actual,
    getRedis: () => ({
      incr: mockIncr,
      expire: mockExpire,
      incrby: mockIncrby,
      get: mockGet,
    }),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

import { checkAiRateLimit, recordTokenUsage, getAiUsageStats } from '../../src/llm/rate-limiter.js'

describe('checkAiRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env['AI_MAX_REQUESTS_PER_MIN']
  })

  it('passes when under AI_MAX_REQUESTS_PER_MIN limit', async () => {
    mockIncr.mockResolvedValueOnce(1) // first request in window
    mockExpire.mockResolvedValueOnce(1)

    await expect(checkAiRateLimit('ws-abc')).resolves.toBeUndefined()
    expect(mockIncr).toHaveBeenCalledWith(expect.stringContaining('ai:ratelimit:req:ws-abc:'))
  })

  it('sets TTL on first request in window', async () => {
    mockIncr.mockResolvedValueOnce(1)
    mockExpire.mockResolvedValueOnce(1)

    await checkAiRateLimit('ws-abc')
    expect(mockExpire).toHaveBeenCalledWith(expect.stringContaining('ai:ratelimit:req:ws-abc:'), 60)
  })

  it('does not set TTL after first request', async () => {
    mockIncr.mockResolvedValueOnce(5) // 5th request, not first
    mockExpire.mockResolvedValueOnce(1)

    await checkAiRateLimit('ws-abc')
    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('throws AI_RATE_LIMITED when over limit', async () => {
    const limit = 60
    mockIncr.mockResolvedValueOnce(limit + 1) // over the default limit of 60

    await expect(checkAiRateLimit('ws-abc')).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
    })
  })

  it('throws AI_RATE_LIMITED exactly at limit + 1', async () => {
    mockIncr.mockResolvedValueOnce(61)

    await expect(checkAiRateLimit('ws-abc')).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      message: expect.stringContaining('60/min'),
    })
  })

  it('uses workspace-specific Redis keys', async () => {
    mockIncr.mockResolvedValueOnce(1)
    mockExpire.mockResolvedValueOnce(1)

    await checkAiRateLimit('ws-unique-123')
    expect(mockIncr).toHaveBeenCalledWith(expect.stringContaining('ws-unique-123'))
  })
})

describe('recordTokenUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('increments Redis token key with combined input+output tokens', async () => {
    mockIncrby.mockResolvedValueOnce(500)
    mockExpire.mockResolvedValueOnce(1)

    await recordTokenUsage('ws-abc', 300, 200)
    expect(mockIncrby).toHaveBeenCalledWith(
      expect.stringContaining('ai:ratelimit:tokens:ws-abc:'),
      500,
    )
  })

  it('sets 60 second TTL on token key', async () => {
    mockIncrby.mockResolvedValueOnce(500)
    mockExpire.mockResolvedValueOnce(1)

    await recordTokenUsage('ws-abc', 100, 50)
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining('ai:ratelimit:tokens:ws-abc:'),
      60,
    )
  })
})

describe('getAiUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed request and token counts', async () => {
    mockGet.mockResolvedValueOnce('42').mockResolvedValueOnce('8500')

    const stats = await getAiUsageStats('ws-abc')
    expect(stats.requestsThisMinute).toBe(42)
    expect(stats.tokensThisMinute).toBe(8500)
  })

  it('returns zero when no usage data exists', async () => {
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

    const stats = await getAiUsageStats('ws-abc')
    expect(stats.requestsThisMinute).toBe(0)
    expect(stats.tokensThisMinute).toBe(0)
  })
})
