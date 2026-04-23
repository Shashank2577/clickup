import { Router, NextFunction } from 'express'
import {
  SummarizeInputSchema,
  SummarizeOutputSchema,
  SummarizeOutput,
  SummarizeTargetType,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../llm/client.js'
import { buildSummarizePrompt } from '../prompts/summarize.prompt.js'

const SYSTEM_PROMPTS: Record<SummarizeTargetType, string> = {
  task:           'Summarize this task description concisely. Return JSON: { summary: string, keyPoints?: string[] }',
  comment_thread: 'Summarize this discussion thread, capturing the key decisions and open questions. Return JSON: { summary: string, keyPoints?: string[] }',
  doc:            'Summarize this document clearly. Return JSON: { summary: string, keyPoints?: string[] }',
}

export function createSummarizeRouter(): Router {
  const router = Router()

  router.post(
    '/summarize',
    requireAuth,
    asyncHandler(async (req, res, _next: NextFunction) => {
      const input = validate(SummarizeInputSchema, req.body)

      const messages = [{ role: 'user' as const, content: buildSummarizePrompt(input) }]
      const response = await callClaude(messages, {
        workspaceId:  input.workspaceId,
        maxTokens:    2048,
        timeoutMs:    30_000,
        systemPrompt: SYSTEM_PROMPTS[input.type],
      })

      let parsed: SummarizeOutput
      try {
        parsed = JSON.parse(response.content) as SummarizeOutput
        validate(SummarizeOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for summarize')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      res.json({ data: parsed })
    }),
  )

  return router
}
