import Redis from 'ioredis'
import { logger } from '../logging/logger.js'

// ============================================================
// Three-tier cache client
// Tier 1: Request-scoped (in-memory Map, per request lifetime)
// Tier 2: Short-lived Redis (60s TTL — workspace members, user profiles)
// Tier 3: Long-lived Redis (5min TTL — computed aggregates, rollups)
// ============================================================

let redisClient: Redis | null = null

export function getRedis(): Redis {
  if (redisClient === null) {
    redisClient = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      password: process.env['REDIS_PASSWORD'],
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    })

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error')
    })
  }
  return redisClient
}

// ============================================================
// Tier 1: Request-scoped cache
// Use for: permission checks within a single request
// ============================================================

export function createRequestCache(): Map<string, unknown> {
  return new Map()
}

export function requestCacheGet<T>(cache: Map<string, unknown>, key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function requestCacheSet(cache: Map<string, unknown>, key: string, value: unknown): void {
  cache.set(key, value)
}

// ============================================================
// Tier 2: Short-lived Redis cache (60 seconds)
// Use for: workspace members, user profiles, space hierarchy
// ============================================================

const TIER2_TTL = 60

export async function tier2Get<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get(key)
    if (value === null) return null
    return JSON.parse(value) as T
  } catch (err) {
    logger.warn({ err, key }, 'Tier2 cache get failed')
    return null
  }
}

export async function tier2Set(key: string, value: unknown): Promise<void> {
  try {
    await getRedis().setex(key, TIER2_TTL, JSON.stringify(value))
  } catch (err) {
    logger.warn({ err, key }, 'Tier2 cache set failed')
  }
}

export async function tier2Del(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch (err) {
    logger.warn({ err, key }, 'Tier2 cache del failed')
  }
}

// ============================================================
// Tier 3: Long-lived Redis cache (5 minutes)
// Use for: task counts, rollup aggregates, computed metrics
// ============================================================

const TIER3_TTL = 300

export async function tier3Get<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get(key)
    if (value === null) return null
    return JSON.parse(value) as T
  } catch (err) {
    logger.warn({ err, key }, 'Tier3 cache get failed')
    return null
  }
}

export async function tier3Set(key: string, value: unknown): Promise<void> {
  try {
    await getRedis().setex(key, TIER3_TTL, JSON.stringify(value))
  } catch (err) {
    logger.warn({ err, key }, 'Tier3 cache set failed')
  }
}

export async function tier3Del(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch (err) {
    logger.warn({ err, key }, 'Tier3 cache del failed')
  }
}

// ============================================================
// Cache key builders — consistent naming across all services
// ============================================================

export const CacheKeys = {
  workspaceMembers: (workspaceId: string) => `ws:members:${workspaceId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  spaceHierarchy: (workspaceId: string) => `ws:spaces:${workspaceId}`,
  taskSubtreeCount: (taskId: string) => `task:subtree:${taskId}`,
  listTaskCount: (listId: string) => `list:count:${listId}`,
  goalProgress: (goalId: string) => `goal:progress:${goalId}`,
  doc: (docId: string) => `doc:${docId}`,
  docList: (workspaceId: string) => `doc:list:${workspaceId}`,
}
