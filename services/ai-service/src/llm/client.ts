// src/llm/client.ts
// Wraps the Anthropic SDK with:
// - Retry with exponential backoff (overload/rate-limit)
// - 30s timeout enforcement
// - Error normalization to AppError
// - Per-workspace API key override (fallback to env var)

import Anthropic from '@anthropic-ai/sdk'
import { AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// Model to use — Claude 3.5 Sonnet for cost/quality balance in self-hosted deployments
const DEFAULT_MODEL = 'claude-sonnet-4-5-20251001' as const

export interface LlmCallOptions {
  workspaceId: string
  apiKey?: string          // per-workspace key (future: loaded from DB); falls back to env
  maxTokens?: number       // default: 1024
  temperature?: number     // default: 0 (deterministic for structured outputs)
  systemPrompt?: string
  timeoutMs?: number       // default: 30_000
}

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
}

/**
 * Calls Claude with retry logic and error normalization.
 * This is the ONLY function in the codebase that calls the Anthropic API.
 * All AI capabilities (breakdown, summarize, etc.) call this.
 */
export async function callClaude(
  messages: LlmMessage[],
  options: LlmCallOptions,
): Promise<LlmResponse> {
  const apiKey = options.apiKey
    ?? process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    throw new AppError(ErrorCode.AI_API_KEY_MISSING,
      'No Anthropic API key configured. Set ANTHROPIC_API_KEY in your environment.')
  }

  const client = new Anthropic({
    apiKey,
    timeout: options.timeoutMs ?? 30_000,
    maxRetries: 0, // We handle retries ourselves for full control
  })

  return await callWithRetry(client, messages, options)
}

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1_000

async function callWithRetry(
  client: Anthropic,
  messages: LlmMessage[],
  options: LlmCallOptions,
  attempt = 0,
): Promise<LlmResponse> {
  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0,
      system: options.systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    return {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    }

  } catch (err) {
    return await handleApiError(err, client, messages, options, attempt)
  }
}

async function handleApiError(
  err: unknown,
  client: Anthropic,
  messages: LlmMessage[],
  options: LlmCallOptions,
  attempt: number,
): Promise<LlmResponse> {
  // Anthropic SDK throws typed errors we can inspect
  if (err instanceof Anthropic.APIError) {
    // Failure mode 5: invalid/expired API key
    if (err.status === 401) {
      throw new AppError(ErrorCode.AI_UNAVAILABLE,
        'Anthropic API key is invalid or expired.')
    }

    // Failure mode 2: rate limited
    if (err.status === 429) {
      const retryAfter = parseInt((err.headers as Record<string, string>)?.['retry-after'] ?? '5', 10)
      if (attempt < MAX_RETRIES) {
        logger.warn({ attempt, retryAfter }, 'Claude rate limited — retrying')
        await sleep(retryAfter * 1_000)
        return callWithRetry(client, messages, options, attempt + 1)
      }
      throw new AppError(ErrorCode.AI_RATE_LIMITED,
        `Claude rate limit exceeded. Retry after ${retryAfter}s.`)
    }

    // Failure mode 3: server overload (529 or 503)
    if (err.status === 529 || err.status === 503) {
      if (attempt < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        logger.warn({ attempt, backoff }, 'Claude overloaded — exponential backoff')
        await sleep(backoff)
        return callWithRetry(client, messages, options, attempt + 1)
      }
      throw new AppError(ErrorCode.AI_UNAVAILABLE,
        'Claude API is temporarily unavailable. Please try again later.')
    }
  }

  // Failure mode 4: timeout
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    throw new AppError(ErrorCode.AI_UNAVAILABLE,
      'Claude API request timed out after 30 seconds.')
  }

  // Unexpected error — log and rethrow
  logger.error({ err }, 'Unexpected Claude API error')
  throw new AppError(ErrorCode.AI_UNAVAILABLE, 'Unexpected AI service error.')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
