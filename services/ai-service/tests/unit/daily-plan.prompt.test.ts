import { describe, it, expect } from 'vitest'
import { buildDailyPlanPrompt } from '../../src/prompts/daily-plan.prompt.js'

const BASE_INPUT = {
  userId: '00000000-0000-0000-0000-000000000001',
  workspaceId: '00000000-0000-0000-0000-000000000002',
  date: '2026-04-21',
  availableMinutes: 240,
}

const TASKS = [
  { id: 'task-1', title: 'Write tests', estimatedMinutes: 60, status: 'open' },
  { id: 'task-2', title: 'Code review', estimatedMinutes: 30, status: 'open' },
]

describe('buildDailyPlanPrompt', () => {
  it('includes date in output', () => {
    const result = buildDailyPlanPrompt(BASE_INPUT, TASKS)
    expect(result).toContain('2026-04-21')
  })

  it('uses 480 when availableMinutes is undefined', () => {
    const { availableMinutes: _, ...inputWithoutMinutes } = BASE_INPUT
    const result = buildDailyPlanPrompt(inputWithoutMinutes, TASKS)
    expect(result).toContain('480 minutes')
  })

  it('uses provided availableMinutes value', () => {
    const result = buildDailyPlanPrompt(BASE_INPUT, TASKS)
    expect(result).toContain('240 minutes')
  })

  it('lists all fetched task IDs and titles', () => {
    const result = buildDailyPlanPrompt(BASE_INPUT, TASKS)
    expect(result).toContain('task-1')
    expect(result).toContain('Write tests')
    expect(result).toContain('task-2')
    expect(result).toContain('Code review')
  })

  it('handles empty task list gracefully', () => {
    const result = buildDailyPlanPrompt(BASE_INPUT, [])
    expect(result).toContain('no tasks found')
  })
})
