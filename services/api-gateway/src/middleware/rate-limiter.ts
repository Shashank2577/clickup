import type { Request, Response, NextFunction } from 'express'
import { createClient } from 'redis'
import { AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

let redisClient: ReturnType<typeof createClient> | null = null

export async function initRedis(): Promise<void> {
  const host = process.env['REDIS_HOST'] ?? 'localhost'
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

  redisClient = createClient({ socket: { host, port } })
  redisClient.on('error', (err) => {
    // Log but don't crash — degrade gracefully if Redis is unavailable
    console.warn('Redis client error:', err)
  })
  await redisClient.connect()
}

const MUTATIONS_MAX = parseInt(process.env['RATE_LIMIT_MUTATIONS_MAX'] ?? '250', 10)
const MUTATIONS_WINDOW = parseInt(process.env['RATE_LIMIT_MUTATIONS_WINDOW_SECONDS'] ?? '30', 10)
const READS_MAX = parseInt(process.env['RATE_LIMIT_READS_MAX'] ?? '1000', 10)
const READS_WINDOW = parseInt(process.env['RATE_LIMIT_READS_WINDOW_SECONDS'] ?? '60', 10)

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function rateLimiter(isMutation: boolean) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.headers['x-user-id'] as string | undefined

    // Unauthenticated requests (public routes) skip rate limiting
    if (!userId || !redisClient) {
      next()
      return
    }

    const effectivelyMutation = isMutation || MUTATION_METHODS.has(req.method)
    const max = effectivelyMutation ? MUTATIONS_MAX : READS_MAX
    const windowSeconds = effectivelyMutation ? MUTATIONS_WINDOW : READS_WINDOW
    const suffix = effectivelyMutation ? 'mut' : 'read'
    const key = `rl:${userId}:${suffix}`

    try {
      const current = await redisClient.incr(key)
      if (current === 1) {
        await redisClient.expire(key, windowSeconds)
      }

      if (current > max) {
        next(new AppError(ErrorCode.SYSTEM_RATE_LIMITED, `Rate limit exceeded: ${max} ${suffix}s per ${windowSeconds}s`))
        return
      }
    } catch {
      // Redis unavailable — fail open (allow request through)
      next()
      return
    }

    next()
  }
}
