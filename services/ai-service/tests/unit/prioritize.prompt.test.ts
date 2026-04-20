import { describe, it, expect } from 'vitest'
import { buildPrioritizePrompt } from '../../src/prompts/prioritize.prompt.js'

const TASKS = [
  { id: 'uuid-1', title: 'Task Alpha', dueDate: '2026-05-01', estimatedMinutes: 60, status: 'open' },
  { id: 'uuid-2', title: 'Task Beta',  dueDate: null,         estimatedMinutes: null, status: 'in_progress' },
]

const BASE = {
  tasks: TASKS,
  workspaceId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
}

describe('buildPrioritizePrompt', () => {
  it('includes all task IDs in output', () => {
    const result = buildPrioritizePrompt(BASE)
    expect(result).toContain('uuid-1')
    expect(result).toContain('uuid-2')
  })

  it('includes dueDate when provided', () => {
    const result = buildPrioritizePrompt(BASE)
    expect(result).toContain('2026-05-01')
  })

  it('includes estimatedMinutes when provided', () => {
    const result = buildPrioritizePrompt(BASE)
    expect(result).toContain('60m')
  })

  it('includes status when provided', () => {
    const result = buildPrioritizePrompt(BASE)
    expect(result).toContain('open')
    expect(result).toContain('in_progress')
  })

  it('omits optional fields when not provided', () => {
    const result = buildPrioritizePrompt(BASE)
    // Task Beta has null dueDate and estimatedMinutes — should not appear with "due:" prefix for that task
    const betaLine = result.split('\n').find(l => l.includes('uuid-2')) ?? ''
    expect(betaLine).not.toContain('due:')
    expect(betaLine).not.toContain('est:')
  })

  it('shows correct task count in output', () => {
    const result = buildPrioritizePrompt(BASE)
    expect(result).toContain('2 tasks')
  })
})
