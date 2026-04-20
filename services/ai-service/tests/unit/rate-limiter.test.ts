import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkAiRateLimit, recordTokenUsage, getAiUsageStats } from '../../src/llm/rate-limiter'
import { getRedis, ErrorCode } from '@clickup/sdk'

// Mock getRedis
vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal() as any
  const mockRedis = {
    incr: vi.fn(),
    expire: vi.fn(),
    incrby: vi.fn(),
    get: vi.fn()
  }
  return {
    ...actual,
    getRedis: vi.fn(() => mockRedis)
  }
})

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z')) // Epoch 1735732800000, Window 28928880
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkAiRateLimit', () => {
    it('passes when under AI_MAX_REQUESTS_PER_MIN limit', async () => {
      const redis = getRedis()
      vi.mocked(redis.incr).mockResolvedValueOnce(5)

      await expect(checkAiRateLimit('ws-1')).resolves.toBeUndefined()

      expect(redis.incr).toHaveBeenCalledWith('ai:ratelimit:req:ws-1:28928880')
      expect(redis.expire).not.toHaveBeenCalled()
    })

    it('sets expiry on first request', async () => {
      const redis = getRedis()
      vi.mocked(redis.incr).mockResolvedValueOnce(1)

      await expect(checkAiRateLimit('ws-1')).resolves.toBeUndefined()

      expect(redis.expire).toHaveBeenCalledWith('ai:ratelimit:req:ws-1:28928880', 60)
    })

    it('throws AI_RATE_LIMITED when over limit', async () => {
      const redis = getRedis()
      vi.mocked(redis.incr).mockResolvedValueOnce(61) // Assuming default max 60

      await expect(checkAiRateLimit('ws-1')).rejects.toMatchObject({
        code: ErrorCode.AI_RATE_LIMITED
      })
    })
  })

  describe('recordTokenUsage', () => {
    it('increments Redis key correctly', async () => {
      const redis = getRedis()
      vi.mocked(redis.incrby).mockResolvedValueOnce(150)

      await expect(recordTokenUsage('ws-1', 100, 50)).resolves.toBeUndefined()

      expect(redis.incrby).toHaveBeenCalledWith('ai:ratelimit:tokens:ws-1:28928880', 150)
      expect(redis.expire).toHaveBeenCalledWith('ai:ratelimit:tokens:ws-1:28928880', 60)
    })
  })

  describe('getAiUsageStats', () => {
    it('returns default 0 values when redis returns null', async () => {
      const redis = getRedis()
      vi.mocked(redis.get).mockResolvedValue(null as any)

      const stats = await getAiUsageStats('ws-1')
      expect(stats).toEqual({
        requestsThisMinute: 0,
        tokensThisMinute: 0
      })
    })

    it('returns correct parsed values', async () => {
      const redis = getRedis()
      vi.mocked(redis.get)
        .mockResolvedValueOnce('42' as any)
        .mockResolvedValueOnce('5000' as any)

      const stats = await getAiUsageStats('ws-1')
      expect(stats).toEqual({
        requestsThisMinute: 42,
        tokensThisMinute: 5000
      })
    })
  })
})
