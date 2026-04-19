import { describe, it, expect, vi } from 'vitest'
import { ErrorCode } from '@clickup/contracts'

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

import {
  parseAiResponse,
  TaskBreakdownOutputSchema,
  SummarizeOutputSchema,
  PrioritizeOutputSchema,
  DailyPlanOutputSchema,
} from '../../src/llm/response-parser.js'

describe('parseAiResponse', () => {
  describe('happy path', () => {
    it('returns typed data when Claude output is valid JSON', () => {
      const raw = JSON.stringify({
        summary: 'A short summary.',
        keyPoints: ['point one', 'point two'],
        actionItems: [],
      })

      const result = parseAiResponse<{ summary: string }>(raw, SummarizeOutputSchema, 'summarize')
      expect(result.summary).toBe('A short summary.')
    })

    it('strips markdown code fences before parsing (```json)', () => {
      const raw = '```json\n{"summary":"Hello","keyPoints":[],"actionItems":[]}\n```'
      const result = parseAiResponse<{ summary: string }>(raw, SummarizeOutputSchema, 'summarize')
      expect(result.summary).toBe('Hello')
    })

    it('strips plain markdown code fences before parsing (```)', () => {
      const raw = '```\n{"summary":"World","keyPoints":[],"actionItems":[]}\n```'
      const result = parseAiResponse<{ summary: string }>(raw, SummarizeOutputSchema, 'summarize')
      expect(result.summary).toBe('World')
    })

    it('parses TaskBreakdownOutputSchema correctly', () => {
      const raw = JSON.stringify({
        subtasks: [{ title: 'Sub 1', description: 'do it', estimatedHours: 2 }],
        summary: 'Overall task',
      })
      const result = parseAiResponse(raw, TaskBreakdownOutputSchema, 'task-breakdown')
      expect(result).toMatchObject({ summary: 'Overall task' })
    })

    it('parses PrioritizeOutputSchema correctly', () => {
      const raw = JSON.stringify({
        orderedTaskIds: ['t1', 't2'],
        reasoning: { t1: 'most important', t2: 'second priority' },
      })
      const result = parseAiResponse(raw, PrioritizeOutputSchema, 'prioritize')
      expect(result).toMatchObject({ orderedTaskIds: ['t1', 't2'] })
    })

    it('parses DailyPlanOutputSchema correctly', () => {
      const raw = JSON.stringify({
        schedule: [{ taskId: 't1', title: 'Task 1', estimatedHours: 2, startTime: '09:00' }],
        totalScheduledHours: 2,
        isOverloaded: false,
        droppedTaskIds: [],
        notes: 'Good day',
      })
      const result = parseAiResponse(raw, DailyPlanOutputSchema, 'daily-plan')
      expect(result).toMatchObject({ totalScheduledHours: 2, isOverloaded: false })
    })
  })

  describe('failure modes', () => {
    it('throws AI_INVALID_RESPONSE when JSON is malformed', () => {
      const raw = 'this is not json at all!'
      expect(() => parseAiResponse(raw, SummarizeOutputSchema, 'summarize')).toThrow(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })

    it('throws AI_INVALID_RESPONSE when JSON schema mismatch', () => {
      // Missing required 'summary' field
      const raw = JSON.stringify({ keyPoints: ['point'], actionItems: [] })
      expect(() => parseAiResponse(raw, SummarizeOutputSchema, 'summarize')).toThrow(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })

    it('includes capability name in error message', () => {
      const raw = 'not valid json'
      expect(() => parseAiResponse(raw, SummarizeOutputSchema, 'my-capability')).toThrow(
        expect.objectContaining({ message: expect.stringContaining('my-capability') })
      )
    })

    it('throws AI_INVALID_RESPONSE for empty string input', () => {
      expect(() => parseAiResponse('', SummarizeOutputSchema, 'summarize')).toThrow(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })

    it('throws AI_INVALID_RESPONSE when TaskBreakdownOutputSchema has too many subtasks', () => {
      const tooManySubtasks = Array.from({ length: 11 }, (_, i) => ({ title: `Sub ${i + 1}` }))
      const raw = JSON.stringify({ subtasks: tooManySubtasks, summary: 'too many' })
      expect(() => parseAiResponse(raw, TaskBreakdownOutputSchema, 'task-breakdown')).toThrow(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })
  })
})
