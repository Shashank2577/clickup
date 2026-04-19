// src/llm/rate-limiter.ts
// Token bucket rate limiter per workspace.
// Prevents a single workspace from consuming all AI capacity.
//
// Limits (configurable via env):
//   AI_MAX_TOKENS_PER_MIN=100_000    (input + output tokens per workspace per minute)
//   AI_MAX_REQUESTS_PER_MIN=60       (requests per workspace per minute)
//
// Uses Redis for distributed state — works across multiple ai-service instances.

import { getRedis, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

const MAX_TOKENS_PER_MIN = parseInt(process.env['AI_MAX_TOKENS_PER_MIN'] ?? '100000', 10)
const MAX_REQUESTS_PER_MIN = parseInt(process.env['AI_MAX_REQUESTS_PER_MIN'] ?? '60', 10)

/**
 * Checks if the workspace is within rate limits BEFORE calling Claude.
 * Throws AI_RATE_LIMITED if over limit.
 */
export async function checkAiRateLimit(workspaceId: string): Promise<void> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000) // 1-minute window
  const requestKey = `ai:ratelimit:req:${workspaceId}:${window}`

  const requestCount = await redis.incr(requestKey)
  if (requestCount === 1) await redis.expire(requestKey, 60)

  if (requestCount > MAX_REQUESTS_PER_MIN) {
    throw new AppError(ErrorCode.AI_RATE_LIMITED,
      `AI request limit of ${MAX_REQUESTS_PER_MIN}/min exceeded for this workspace.`)
  }
}

/**
 * Records token usage AFTER a successful Claude call.
 * For observability — token limit enforcement is a Wave 3 feature.
 */
export async function recordTokenUsage(
  workspaceId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000)
  const tokenKey = `ai:ratelimit:tokens:${workspaceId}:${window}`

  const total = inputTokens + outputTokens
  await redis.incrby(tokenKey, total)
  await redis.expire(tokenKey, 60)
}

/**
 * Returns current usage stats for a workspace (for /health or admin endpoints).
 */
export async function getAiUsageStats(workspaceId: string): Promise<{
  requestsThisMinute: number
  tokensThisMinute: number
}> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000)

  const [requests, tokens] = await Promise.all([
    redis.get(`ai:ratelimit:req:${workspaceId}:${window}`),
    redis.get(`ai:ratelimit:tokens:${workspaceId}:${window}`),
  ])

  return {
    requestsThisMinute: parseInt(requests ?? '0', 10),
    tokensThisMinute: parseInt(tokens ?? '0', 10),
  }
}

// Export limits for use in tests
export { MAX_TOKENS_PER_MIN, MAX_REQUESTS_PER_MIN }
