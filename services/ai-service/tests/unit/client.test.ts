import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorCode } from '@clickup/contracts'

// Mock @anthropic-ai/sdk before importing callClaude
vi.mock('@anthropic-ai/sdk', () => {
  const APIError = class extends Error {
    status: number
    headers: Record<string, string>
    constructor(status: number, message: string, headers: Record<string, string> = {}) {
      super(message)
      this.status = status
      this.headers = headers
    }
  }

  const APIConnectionTimeoutError = class extends Error {
    constructor() {
      super('Connection timed out')
    }
  }

  const mockCreate = vi.fn()

  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }))

  // Attach static error classes to the constructor
  Object.assign(Anthropic, { APIError, APIConnectionTimeoutError })

  return {
    default: Anthropic,
    __mockCreate: mockCreate,
  }
})

// Mock @clickup/sdk logger to suppress output in tests
vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clickup/sdk')>()
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

import { callClaude } from '../../src/llm/client.js'

// Helper to get the mocked create function
async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk') as { __mockCreate: ReturnType<typeof vi.fn> }
  return mod.__mockCreate
}

const VALID_RESPONSE = {
  content: [{ type: 'text', text: '{"result":"ok"}' }],
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-sonnet-4-5-20251001',
}

describe('callClaude', () => {
  const baseOptions = {
    workspaceId: 'ws-123',
    apiKey: 'sk-ant-test-key',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env['ANTHROPIC_API_KEY']
  })

  afterEach(() => {
    delete process.env['ANTHROPIC_API_KEY']
  })

  it('throws AI_API_KEY_MISSING when no API key in env or options', async () => {
    const options = { workspaceId: 'ws-123' } // no apiKey
    delete process.env['ANTHROPIC_API_KEY']

    await expect(
      callClaude([{ role: 'user', content: 'test' }], options)
    ).rejects.toMatchObject({ code: ErrorCode.AI_API_KEY_MISSING })
  })

  it('uses ANTHROPIC_API_KEY env var as fallback when no apiKey in options', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env-key'
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(VALID_RESPONSE)

    const result = await callClaude(
      [{ role: 'user', content: 'hello' }],
      { workspaceId: 'ws-123' }
    )
    expect(result.content).toBe('{"result":"ok"}')
  })

  it('returns LlmResponse on successful API call', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(VALID_RESPONSE)

    const result = await callClaude(
      [{ role: 'user', content: 'hello' }],
      baseOptions
    )

    expect(result.content).toBe('{"result":"ok"}')
    expect(result.inputTokens).toBe(10)
    expect(result.outputTokens).toBe(5)
    expect(result.model).toBe('claude-sonnet-4-5-20251001')
  })

  it('throws AI_UNAVAILABLE (maps auth failure) on Anthropic 401 response', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIError: new (status: number, message: string) => Error
    }
    mockCreate.mockRejectedValueOnce(new Anthropic.APIError(401, 'Unauthorized'))

    await expect(
      callClaude([{ role: 'user', content: 'test' }], baseOptions)
    ).rejects.toMatchObject({ code: ErrorCode.AI_UNAVAILABLE })
  })

  it('retries up to 3 times on 429 (rate limit), then throws AI_RATE_LIMITED', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIError: new (status: number, message: string, headers?: Record<string, string>) => Error
    }

    // Fail 4 times (initial + 3 retries) — all with 429
    const rateLimitErr = new Anthropic.APIError(429, 'Rate limited', { 'retry-after': '0' })
    mockCreate.mockRejectedValue(rateLimitErr)

    await expect(
      callClaude([{ role: 'user', content: 'test' }], baseOptions)
    ).rejects.toMatchObject({ code: ErrorCode.AI_RATE_LIMITED })

    // initial attempt + 3 retries = 4 total calls
    expect(mockCreate).toHaveBeenCalledTimes(4)
  }, 10000)

  it('retries with exponential backoff on 503, then throws AI_UNAVAILABLE', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIError: new (status: number, message: string) => Error
    }

    const overloadErr = new Anthropic.APIError(503, 'Service unavailable')
    mockCreate.mockRejectedValue(overloadErr)

    await expect(
      callClaude([{ role: 'user', content: 'test' }], baseOptions)
    ).rejects.toMatchObject({ code: ErrorCode.AI_UNAVAILABLE })

    // initial attempt + 3 retries = 4 total calls
    expect(mockCreate).toHaveBeenCalledTimes(4)
  }, 15000)

  it('retries with exponential backoff on 529, then throws AI_UNAVAILABLE', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIError: new (status: number, message: string) => Error
    }

    const overloadErr = new Anthropic.APIError(529, 'Overloaded')
    mockCreate.mockRejectedValue(overloadErr)

    await expect(
      callClaude([{ role: 'user', content: 'test' }], baseOptions)
    ).rejects.toMatchObject({ code: ErrorCode.AI_UNAVAILABLE })

    expect(mockCreate).toHaveBeenCalledTimes(4)
  }, 15000)

  it('throws AI_UNAVAILABLE on connection timeout', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIConnectionTimeoutError: new () => Error
    }
    mockCreate.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError())

    await expect(
      callClaude([{ role: 'user', content: 'test' }], baseOptions)
    ).rejects.toMatchObject({
      code: ErrorCode.AI_UNAVAILABLE,
      message: expect.stringContaining('timed out'),
    })
  })

  it('recovers on retry when 503 resolves on second attempt', async () => {
    const mockCreate = await getMockCreate()
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      APIError: new (status: number, message: string) => Error
    }

    mockCreate
      .mockRejectedValueOnce(new Anthropic.APIError(503, 'Overloaded'))
      .mockResolvedValueOnce(VALID_RESPONSE)

    const result = await callClaude([{ role: 'user', content: 'test' }], baseOptions)
    expect(result.content).toBe('{"result":"ok"}')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  }, 10000)
})
