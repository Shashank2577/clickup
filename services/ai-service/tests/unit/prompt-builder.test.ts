import { describe, it, expect } from 'vitest'
import {
  SYSTEM_PROMPTS,
  buildTaskBreakdownMessage,
  buildSummarizeMessage,
  buildPrioritizeMessage,
  buildDailyPlanMessage
} from '../../src/llm/prompt-builder'

describe('prompt-builder', () => {
  describe('SYSTEM_PROMPTS', () => {
    it('all prompts include "Output ONLY valid JSON" instruction', () => {
      Object.values(SYSTEM_PROMPTS).forEach(prompt => {
        expect(prompt).toContain('Output ONLY valid JSON')
      })
    })
  })

  describe('buildTaskBreakdownMessage', () => {
    it('includes title, description, and context', () => {
      const msg = buildTaskBreakdownMessage({
        title: 'Fix auth bug',
        description: 'Users cannot login',
        context: 'Affects wave 2'
      })
      expect(msg).toContain('Task: Fix auth bug')
      expect(msg).toContain('Description: Users cannot login')
      expect(msg).toContain('Additional context: Affects wave 2')
    })

    it('handles missing description and context', () => {
      const msg = buildTaskBreakdownMessage({ title: 'Fix auth bug' })
      expect(msg).toContain('Task: Fix auth bug')
      expect(msg).not.toContain('Description:')
      expect(msg).not.toContain('Additional context:')
    })
  })

  describe('buildSummarizeMessage', () => {
    it('builds summarize message correctly', () => {
      const msg = buildSummarizeMessage({
        content: 'Long thread here...',
        targetType: 'thread'
      })
      expect(msg).toBe('Summarize this thread:\n\nLong thread here...')
    })
  })

  describe('buildPrioritizeMessage', () => {
    it('builds prioritize message correctly', () => {
      const msg = buildPrioritizeMessage({
        tasks: [
          { id: 't1', title: 'Task 1' },
          { id: 't2', title: 'Task 2', dueDate: '2025-01-01' }
        ]
      })
      expect(msg).toContain('Prioritize these 2 tasks')
      expect(msg).toContain('- ID: t1 | Task 1')
      expect(msg).toContain('- ID: t2 | Task 2 (due: 2025-01-01)')
    })
  })

  describe('buildDailyPlanMessage', () => {
    it('builds daily plan message correctly', () => {
      const msg = buildDailyPlanMessage({
        tasks: [
          { id: 't1', title: 'Task 1', estimatedHours: 2, priority: 'high' }
        ],
        availableHours: 8,
        date: '2025-01-01'
      })
      expect(msg).toContain('Create a daily plan for 2025-01-01.')
      expect(msg).toContain('Available hours: 8')
      expect(msg).toContain('- ID: t1 | Task 1 | ~2h | priority: high')
    })
  })
})
