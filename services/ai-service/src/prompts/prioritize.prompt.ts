import { PrioritizeInput } from '@clickup/contracts'

export function buildPrioritizePrompt(input: PrioritizeInput): string {
  const taskList = input.tasks
    .map(t => {
      const parts = [`- ID: ${t.id} | Title: ${t.title}`]
      if (t.dueDate)          parts.push(`due: ${t.dueDate}`)
      if (t.estimatedMinutes) parts.push(`est: ${t.estimatedMinutes}m`)
      if (t.status)           parts.push(`status: ${t.status}`)
      return parts.join(' | ')
    })
    .join('\n')

  return `Please prioritize the following ${input.tasks.length} tasks:\n\n${taskList}`
}
