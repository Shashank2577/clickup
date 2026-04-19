import { describe, it, expect } from 'vitest'
import {
  SYSTEM_PROMPTS,
  buildTaskBreakdownMessage,
  buildSummarizeMessage,
  buildPrioritizeMessage,
  buildDailyPlanMessage,
} from '../../src/llm/prompt-builder.js'

describe('SYSTEM_PROMPTS', () => {
  it('TASK_BREAKDOWN includes "Output ONLY valid JSON" instruction', () => {
    expect(SYSTEM_PROMPTS.TASK_BREAKDOWN).toContain('Output ONLY valid JSON')
  })

  it('SUMMARIZE includes "Output ONLY valid JSON" instruction', () => {
    expect(SYSTEM_PROMPTS.SUMMARIZE).toContain('Output ONLY valid JSON')
  })

  it('PRIORITIZE includes "Output ONLY valid JSON" instruction', () => {
    expect(SYSTEM_PROMPTS.PRIORITIZE).toContain('Output ONLY valid JSON')
  })

  it('DAILY_PLAN includes "Output ONLY valid JSON" instruction', () => {
    expect(SYSTEM_PROMPTS.DAILY_PLAN).toContain('Output ONLY valid JSON')
  })

  it('all prompts include Output ONLY valid JSON instruction', () => {
    for (const [key, prompt] of Object.entries(SYSTEM_PROMPTS)) {
      expect(prompt, `${key} should contain JSON instruction`).toContain('Output ONLY valid JSON')
    }
  })
})

describe('buildTaskBreakdownMessage', () => {
  it('includes title', () => {
    const msg = buildTaskBreakdownMessage({ title: 'Build login page' })
    expect(msg).toContain('Build login page')
  })

  it('includes description when provided', () => {
    const msg = buildTaskBreakdownMessage({
      title: 'Build login page',
      description: 'Using React and JWT',
    })
    expect(msg).toContain('Using React and JWT')
  })

  it('includes context when provided', () => {
    const msg = buildTaskBreakdownMessage({
      title: 'Build login page',
      context: 'This is for the mobile app',
    })
    expect(msg).toContain('This is for the mobile app')
  })

  it('omits description section when not provided', () => {
    const msg = buildTaskBreakdownMessage({ title: 'Build login page' })
    expect(msg).not.toContain('Description:')
  })

  it('omits context section when not provided', () => {
    const msg = buildTaskBreakdownMessage({ title: 'Build login page' })
    expect(msg).not.toContain('Additional context:')
  })

  it('includes all three sections when all provided', () => {
    const msg = buildTaskBreakdownMessage({
      title: 'Build login page',
      description: 'desc here',
      context: 'ctx here',
    })
    expect(msg).toContain('Task: Build login page')
    expect(msg).toContain('Description: desc here')
    expect(msg).toContain('Additional context: ctx here')
    expect(msg).toContain('Break this down into subtasks')
  })
})

describe('buildSummarizeMessage', () => {
  it('includes the target type in the message', () => {
    const msg = buildSummarizeMessage({ content: 'some content', targetType: 'task' })
    expect(msg).toContain('task')
  })

  it('includes the content in the message', () => {
    const msg = buildSummarizeMessage({ content: 'important discussion here', targetType: 'thread' })
    expect(msg).toContain('important discussion here')
  })

  it('handles doc type', () => {
    const msg = buildSummarizeMessage({ content: 'doc content', targetType: 'doc' })
    expect(msg).toContain('doc')
    expect(msg).toContain('doc content')
  })
})

describe('buildPrioritizeMessage', () => {
  it('includes all task IDs', () => {
    const msg = buildPrioritizeMessage({
      tasks: [
        { id: 'task-1', title: 'First task' },
        { id: 'task-2', title: 'Second task' },
      ],
    })
    expect(msg).toContain('task-1')
    expect(msg).toContain('task-2')
  })

  it('includes task titles', () => {
    const msg = buildPrioritizeMessage({
      tasks: [{ id: 'task-1', title: 'Fix critical bug' }],
    })
    expect(msg).toContain('Fix critical bug')
  })

  it('includes due date when provided', () => {
    const msg = buildPrioritizeMessage({
      tasks: [{ id: 'task-1', title: 'Task', dueDate: '2026-05-01' }],
    })
    expect(msg).toContain('2026-05-01')
  })

  it('includes task count', () => {
    const msg = buildPrioritizeMessage({
      tasks: [
        { id: 't1', title: 'A' },
        { id: 't2', title: 'B' },
        { id: 't3', title: 'C' },
      ],
    })
    expect(msg).toContain('3 tasks')
  })
})

describe('buildDailyPlanMessage', () => {
  it('includes the date', () => {
    const msg = buildDailyPlanMessage({
      tasks: [],
      availableHours: 8,
      date: '2026-04-19',
    })
    expect(msg).toContain('2026-04-19')
  })

  it('includes available hours', () => {
    const msg = buildDailyPlanMessage({
      tasks: [],
      availableHours: 6,
      date: '2026-04-19',
    })
    expect(msg).toContain('6')
  })

  it('includes all task IDs and titles', () => {
    const msg = buildDailyPlanMessage({
      tasks: [
        { id: 'task-a', title: 'Write tests', estimatedHours: 2 },
        { id: 'task-b', title: 'Code review', estimatedHours: 1 },
      ],
      availableHours: 8,
      date: '2026-04-19',
    })
    expect(msg).toContain('task-a')
    expect(msg).toContain('Write tests')
    expect(msg).toContain('task-b')
    expect(msg).toContain('Code review')
  })

  it('defaults estimatedHours to 1 when not provided', () => {
    const msg = buildDailyPlanMessage({
      tasks: [{ id: 'task-x', title: 'Unknown task' }],
      availableHours: 8,
      date: '2026-04-19',
    })
    expect(msg).toContain('~1h')
  })

  it('defaults priority to "none" when not provided', () => {
    const msg = buildDailyPlanMessage({
      tasks: [{ id: 'task-x', title: 'Unknown task' }],
      availableHours: 8,
      date: '2026-04-19',
    })
    expect(msg).toContain('priority: none')
  })
})
