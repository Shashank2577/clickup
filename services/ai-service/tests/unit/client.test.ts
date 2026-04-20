import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callClaude } from '../../src/llm/client'
import Anthropic from '@anthropic-ai/sdk'
import { AppError, ErrorCode } from '@clickup/sdk'

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => {
  const AnthropicMock = vi.fn().mockImplementation(() => {
    return {
      messages: {
        create: vi.fn()
      }
    }
  })
  // Need to add error classes to the mock
  ;(AnthropicMock as any).APIError = class APIError extends Error {
    status: number;
    headers?: Record<string, string>;
    constructor(status: number, headers?: Record<string, string>) {
      super();
      this.status = status;
      this.headers = headers;
    }
  };
  ;(AnthropicMock as any).APIConnectionTimeoutError = class APIConnectionTimeoutError extends Error {};
  return { default: AnthropicMock }
})

describe('callClaude', () => {
  const mockOptions = { workspaceId: 'ws-1', apiKey: 'test-key' }
  const mockMessages = [{ role: 'user' as const, content: 'hello' }]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws AI_NOT_CONFIGURED when no API key in env or options', async () => {
    const originalEnv = process.env['ANTHROPIC_API_KEY']
    delete process.env['ANTHROPIC_API_KEY']

    await expect(callClaude(mockMessages, { workspaceId: 'ws-1' })).rejects.toMatchObject({
      code: ErrorCode.AI_NOT_CONFIGURED
    })

    process.env['ANTHROPIC_API_KEY'] = originalEnv
  })

  it('throws AI_AUTH_FAILED on Anthropic 401 response', async () => {
    const createMock = vi.fn().mockRejectedValue(new Anthropic.APIError(401))
    vi.mocked(Anthropic).mockImplementationOnce(() => ({ messages: { create: createMock } } as any))

    await expect(callClaude(mockMessages, mockOptions)).rejects.toMatchObject({
      code: ErrorCode.AI_AUTH_FAILED
    })
  })

  it('retries up to 3 times on 429 (rate limit), then throws AI_RATE_LIMITED', async () => {
    const createMock = vi.fn().mockRejectedValue(new Anthropic.APIError(429, { 'retry-after': '1' }))
    vi.mocked(Anthropic).mockImplementationOnce(() => ({ messages: { create: createMock } } as any))

    const promise = callClaude(mockMessages, mockOptions)

    vi.runAllTimersAsync()

    try {
      await promise
    } catch(e) {
      expect(e).toMatchObject({
        code: ErrorCode.AI_RATE_LIMITED
      })
    }

    expect(createMock).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  })

  it('retries with exponential backoff on 503/529, then throws AI_UNAVAILABLE', async () => {
    const createMock = vi.fn().mockRejectedValue(new Anthropic.APIError(503))
    vi.mocked(Anthropic).mockImplementationOnce(() => ({ messages: { create: createMock } } as any))

    const promise = callClaude(mockMessages, mockOptions)

    vi.runAllTimersAsync()

    try {
      await promise
    } catch(e) {
      expect(e).toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE
      })
    }

    expect(createMock).toHaveBeenCalledTimes(4)
  })

  it('throws AI_TIMEOUT on connection timeout', async () => {
    const createMock = vi.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError())
    vi.mocked(Anthropic).mockImplementationOnce(() => ({ messages: { create: createMock } } as any))

    await expect(callClaude(mockMessages, mockOptions)).rejects.toMatchObject({
      code: ErrorCode.AI_TIMEOUT
    })
  })
})
