import { describe, it, expect } from 'vitest'
import { parseAiResponse, TaskBreakdownOutputSchema } from '../../src/llm/response-parser'
import { ErrorCode } from '@clickup/sdk'

describe('response-parser', () => {
  describe('parseAiResponse', () => {
    it('returns typed data when Claude output is valid JSON', () => {
      const raw = JSON.stringify({ summary: 'test', subtasks: [] })
      const result = parseAiResponse(raw, TaskBreakdownOutputSchema, 'test')
      expect(result).toEqual({ summary: 'test', subtasks: [] })
    })

    it('strips markdown code fences before parsing', () => {
      const raw = '```json\n{"summary": "test", "subtasks": []}\n```'
      const result = parseAiResponse(raw, TaskBreakdownOutputSchema, 'test')
      expect(result).toEqual({ summary: 'test', subtasks: [] })
    })

    it('throws AI_INVALID_RESPONSE when JSON is malformed', () => {
      const raw = '{bad json'
      expect(() => parseAiResponse(raw, TaskBreakdownOutputSchema, 'test')).toThrowError(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })

    it('throws AI_INVALID_RESPONSE when JSON schema mismatch', () => {
      const raw = '{"summary": 123}' // summary should be a string
      expect(() => parseAiResponse(raw, TaskBreakdownOutputSchema, 'test')).toThrowError(
        expect.objectContaining({ code: ErrorCode.AI_INVALID_RESPONSE })
      )
    })
  })
})
