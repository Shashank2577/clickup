import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'

// ── Hoist mocks so they are available when vi.mock factories run ──────────────

const { mockCallClaude, mockGet } = vi.hoisted(() => ({
  mockCallClaude: vi.fn(),
  mockGet:        vi.fn(),
}))

vi.mock('../../src/llm/client.js', () => ({ callClaude: mockCallClaude }))

vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clickup/sdk')>()
  return {
    ...actual,
    requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
    createServiceClient: vi.fn(() => ({ get: mockGet })),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
})

// ── App ───────────────────────────────────────────────────────────────────────

import { errorHandler, correlationId } from '@clickup/sdk'
import { routes } from '../../src/routes.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use(correlationId)
  app.use('/', routes())
  app.use(errorHandler)
  return app
}

const app = buildApp()

// ── Constants ─────────────────────────────────────────────────────────────────

const WS_ID   = '00000000-0000-0000-0000-000000000001'
const LIST_ID = '00000000-0000-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000003'
const TASK_ID = '00000000-0000-0000-0000-000000000021'

// ── task-breakdown ────────────────────────────────────────────────────────────

describe('POST /api/v1/ai/task-breakdown', () => {
  const VALID_BODY = { input: 'Build login page', workspaceId: WS_ID, listId: LIST_ID }
  const VALID_RESPONSE = { tasks: [{ title: 'Design UI', estimatedMinutes: 60 }] }

  beforeEach(() => { mockCallClaude.mockReset() })

  it('returns 200 with { data: TaskBreakdownOutput } shape', async () => {
    mockCallClaude.mockResolvedValue({ content: JSON.stringify(VALID_RESPONSE) })
    const res = await request(app).post('/api/v1/ai/task-breakdown').send(VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.body.data.tasks).toBeDefined()
  })

  it('returns 422 when body is missing required fields', async () => {
    const res = await request(app).post('/api/v1/ai/task-breakdown').send({ input: 'x' })
    expect(res.status).toBe(422)
  })

  it('returns 502 AI_INVALID_RESPONSE when callClaude returns bad JSON', async () => {
    mockCallClaude.mockResolvedValue({ content: 'not json at all' })
    const res = await request(app).post('/api/v1/ai/task-breakdown').send(VALID_BODY)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('AI_INVALID_RESPONSE')
  })
})

// ── summarize ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/ai/summarize', () => {
  const VALID_BODY = { content: 'Long description here', type: 'task', workspaceId: WS_ID }
  const VALID_RESPONSE = { summary: 'Short summary', keyPoints: ['Point A'] }

  beforeEach(() => { mockCallClaude.mockReset() })

  it('returns 200 with { data: SummarizeOutput } shape', async () => {
    mockCallClaude.mockResolvedValue({ content: JSON.stringify(VALID_RESPONSE) })
    const res = await request(app).post('/api/v1/ai/summarize').send(VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.body.data.summary).toBeDefined()
  })

  it('returns 422 when body missing required fields', async () => {
    const res = await request(app).post('/api/v1/ai/summarize').send({ content: 'x' })
    expect(res.status).toBe(422)
  })

  it('returns 422 when type is invalid', async () => {
    const res = await request(app).post('/api/v1/ai/summarize').send({ ...VALID_BODY, type: 'unknown' })
    expect(res.status).toBe(422)
  })

  it('returns 502 AI_INVALID_RESPONSE when callClaude returns bad JSON', async () => {
    mockCallClaude.mockResolvedValue({ content: 'bad' })
    const res = await request(app).post('/api/v1/ai/summarize').send(VALID_BODY)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('AI_INVALID_RESPONSE')
  })
})

// ── prioritize ────────────────────────────────────────────────────────────────

describe('POST /api/v1/ai/prioritize', () => {
  const TASKS = [
    { id: '00000000-0000-0000-0000-000000000010', title: 'Task A', dueDate: null, estimatedMinutes: null, status: 'open' },
    { id: '00000000-0000-0000-0000-000000000011', title: 'Task B', dueDate: null, estimatedMinutes: null, status: 'open' },
  ]
  const VALID_BODY = { tasks: TASKS, workspaceId: WS_ID, userId: USER_ID }

  beforeEach(() => { mockCallClaude.mockReset() })

  it('returns 200 with { data: PrioritizeOutput } shape', async () => {
    mockCallClaude.mockResolvedValue({
      content: JSON.stringify({
        ordered: [
          { id: '00000000-0000-0000-0000-000000000010', reasoning: 'First' },
          { id: '00000000-0000-0000-0000-000000000011', reasoning: 'Second' },
        ],
      }),
    })
    const res = await request(app).post('/api/v1/ai/prioritize').send(VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.body.data.ordered).toHaveLength(2)
  })

  it('returns 502 AI_INVALID_RESPONSE when Claude returns wrong IDs', async () => {
    mockCallClaude.mockResolvedValue({
      content: JSON.stringify({
        ordered: [{ id: '00000000-0000-0000-0000-000000000099', reasoning: 'Wrong' }],
      }),
    })
    const res = await request(app).post('/api/v1/ai/prioritize').send(VALID_BODY)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('AI_INVALID_RESPONSE')
  })

  it('returns 422 when tasks array is missing', async () => {
    const res = await request(app).post('/api/v1/ai/prioritize').send({ workspaceId: WS_ID, userId: USER_ID })
    expect(res.status).toBe(422)
  })
})

// ── daily-plan ────────────────────────────────────────────────────────────────

describe('POST /api/v1/ai/daily-plan', () => {
  const VALID_BODY = { userId: USER_ID, workspaceId: WS_ID, date: '2026-04-21' }
  const FETCHED_TASKS = [{ id: TASK_ID, title: 'Write tests', estimatedMinutes: 60 }]
  const VALID_RESPONSE = {
    plan: [{ taskId: TASK_ID, taskTitle: 'Write tests', estimatedMinutes: 60, reasoning: 'Top priority' }],
    totalMinutes: 60,
    overloadWarning: false,
  }

  beforeEach(() => {
    mockCallClaude.mockReset()
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: FETCHED_TASKS })
  })

  it('returns 200 with { data: DailyPlanOutput } shape', async () => {
    mockCallClaude.mockResolvedValue({ content: JSON.stringify(VALID_RESPONSE) })
    const res = await request(app).post('/api/v1/ai/daily-plan').send(VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.body.data.plan).toBeDefined()
    expect(res.body.data.totalMinutes).toBeDefined()
  })

  it('returns 422 when body missing required fields', async () => {
    const res = await request(app).post('/api/v1/ai/daily-plan').send({ date: '2026-04-21' })
    expect(res.status).toBe(422)
  })

  it('returns 502 AI_INVALID_RESPONSE when callClaude returns bad JSON', async () => {
    mockCallClaude.mockResolvedValue({ content: 'bad json' })
    const res = await request(app).post('/api/v1/ai/daily-plan').send(VALID_BODY)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('AI_INVALID_RESPONSE')
  })

  it('propagates task-service HTTP error', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('Service down'), { response: { status: 503 } }))
    const res = await request(app).post('/api/v1/ai/daily-plan').send(VALID_BODY)
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})
