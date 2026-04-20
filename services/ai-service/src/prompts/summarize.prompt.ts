import { SummarizeInput } from '@clickup/contracts'
import { SummarizeTargetType } from '@clickup/contracts'

const TYPE_LABEL: Record<SummarizeTargetType, string> = {
  task: 'task description',
  comment_thread: 'comment thread',
  doc: 'document',
}

export function buildSummarizePrompt(input: SummarizeInput): string {
  const label = TYPE_LABEL[input.type]
  return `Please summarize the following ${label}:\n\n${input.content}`
}
