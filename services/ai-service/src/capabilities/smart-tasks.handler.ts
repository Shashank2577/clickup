import { Router, NextFunction } from 'express'
import { z } from 'zod'
import { ErrorCode } from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../llm/client.js'

const SmartTasksInputSchema = z.object({
  text:        z.string().min(1),
  maxTasks:    z.number().int().min(1).max(50).optional(),
  workspaceId: z.string().uuid(),
})

interface SmartTask {
  title:            string
  description:      string
  priority:         'urgent' | 'high' | 'normal' | 'low'
  estimatedMinutes: number | null
  tags:             string[]
}

interface SmartTasksOutput {
  tasks: SmartTask[]
}

export function createSmartTasksRouter(): Router {
  const router = Router()

  router.post(
    '/smart-tasks',
    requireAuth,
    asyncHandler(async (req, res, _next: NextFunction) => {
      const input = validate(SmartTasksInputSchema, req.body)
      const maxTasks = input.maxTasks ?? 10

      const userPrompt = `Extract actionable tasks from this text. Return a JSON array of tasks, each with: title (concise action), description (context), priority (urgent/high/normal/low), estimatedMinutes (null if unknown), tags (relevant labels).\n\nLimit to ${maxTasks} tasks. Return only the JSON array.\n\nText:\n${input.text}`

      const messages = [{ role: 'user' as const, content: userPrompt }]
      const response = await callClaude(messages, {
        workspaceId: input.workspaceId,
        maxTokens:   3000,
        temperature: 0.3,
        timeoutMs:   30_000,
      })

      let tasks: SmartTask[]
      try {
        const raw = response.content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
        const parsed = JSON.parse(raw) as unknown

        if (!Array.isArray(parsed)) {
          throw new Error('Expected a JSON array')
        }

        tasks = (parsed as SmartTask[]).slice(0, maxTasks).map((t) => ({
          title:            String(t.title ?? ''),
          description:      String(t.description ?? ''),
          priority:         (['urgent', 'high', 'normal', 'low'].includes(t.priority) ? t.priority : 'normal') as SmartTask['priority'],
          estimatedMinutes: typeof t.estimatedMinutes === 'number' ? t.estimatedMinutes : null,
          tags:             Array.isArray(t.tags) ? t.tags.map(String) : [],
        }))
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for smart-tasks')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      res.json({ data: { tasks } })
    }),
  )

  return router
}
