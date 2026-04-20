import { describe, it, expect } from 'vitest'
import { buildBreakdownPrompt } from '../../src/prompts/breakdown.prompt.js'

const BASE_INPUT = {
  input: 'Build a login page',
  workspaceId: '00000000-0000-0000-0000-000000000001',
  listId: '00000000-0000-0000-0000-000000000002',
}

describe('buildBreakdownPrompt', () => {
  it('includes input.input in returned string', () => {
    const result = buildBreakdownPrompt(BASE_INPUT)
    expect(result).toContain('Build a login page')
  })

  it('includes existingTasks when provided', () => {
    const result = buildBreakdownPrompt({
      ...BASE_INPUT,
      context: { existingTasks: ['Task A', 'Task B'] },
    })
    expect(result).toContain('Task A')
    expect(result).toContain('Task B')
  })

  it('includes projectDescription when provided', () => {
    const result = buildBreakdownPrompt({
      ...BASE_INPUT,
      context: { projectDescription: 'A SaaS product for teams' },
    })
    expect(result).toContain('A SaaS product for teams')
  })

  it('omits context block when context is undefined', () => {
    const result = buildBreakdownPrompt(BASE_INPUT)
    expect(result).not.toContain('Existing tasks')
    expect(result).not.toContain('Project context')
  })

  it('omits existingTasks block when array is empty', () => {
    const result = buildBreakdownPrompt({
      ...BASE_INPUT,
      context: { existingTasks: [] },
    })
    expect(result).not.toContain('Existing tasks')
  })
})
