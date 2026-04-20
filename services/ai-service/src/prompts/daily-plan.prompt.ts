import { DailyPlanInput } from '@clickup/contracts'

type FetchedTask = {
  id: string
  title: string
  estimatedMinutes?: number
  status?: string
}

export function buildDailyPlanPrompt(input: DailyPlanInput, tasks: FetchedTask[]): string {
  const availableMinutes = input.availableMinutes ?? 480
  const taskList = tasks
    .map(t => {
      const parts = [`- ID: ${t.id} | ${t.title}`]
      if (t.estimatedMinutes) parts.push(`~${t.estimatedMinutes}m`)
      if (t.status)           parts.push(`status: ${t.status}`)
      return parts.join(' | ')
    })
    .join('\n')

  return [
    `Create an optimal work plan for ${input.date}.`,
    `Available time: ${availableMinutes} minutes.`,
    `\nTasks to schedule:\n${taskList || '(no tasks found)'}`,
  ].join('\n')
}
