import { TaskBreakdownInput } from '@clickup/contracts'

export function buildBreakdownPrompt(input: TaskBreakdownInput): string {
  const parts = [`Task to break down: ${input.input}`]

  if (input.context?.existingTasks?.length) {
    parts.push(`Existing tasks in this project: ${input.context.existingTasks.join(', ')}`)
  }
  if (input.context?.projectDescription) {
    parts.push(`Project context: ${input.context.projectDescription}`)
  }

  return parts.join('\n\n')
}
