import { describe, it, expect } from 'vitest'
import { buildSummarizePrompt } from '../../src/prompts/summarize.prompt.js'

const BASE = {
  workspaceId: '00000000-0000-0000-0000-000000000001',
  content: 'This is a long description about the task.',
}

describe('buildSummarizePrompt', () => {
  it('labels content as "task description" for type "task"', () => {
    const result = buildSummarizePrompt({ ...BASE, type: 'task' })
    expect(result).toContain('task description')
  })

  it('labels content as "comment thread" for type "comment_thread"', () => {
    const result = buildSummarizePrompt({ ...BASE, type: 'comment_thread' })
    expect(result).toContain('comment thread')
  })

  it('labels content as "document" for type "doc"', () => {
    const result = buildSummarizePrompt({ ...BASE, type: 'doc' })
    expect(result).toContain('document')
  })

  it('includes the full content string in output', () => {
    const result = buildSummarizePrompt({ ...BASE, type: 'task' })
    expect(result).toContain(BASE.content)
  })
})
