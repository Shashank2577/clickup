import { Router, NextFunction } from 'express'
import {
  PrioritizeInputSchema,
  PrioritizeOutputSchema,
  PrioritizeOutput,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../llm/client.js'
import { buildPrioritizePrompt } from '../prompts/prioritize.prompt.js'

const SYSTEM_PROMPT = `Given these tasks, return them in priority order (most important first) with reasoning. Return JSON: { ordered: [{ id: string, reasoning: string }] }`

export function createPrioritizeRouter(): Router {
  const router = Router()

  router.post(
    '/api/v1/ai/prioritize',
    requireAuth,
    asyncHandler(async (req, res, _next: NextFunction) => {
      const input = validate(PrioritizeInputSchema, req.body)

      const messages = [{ role: 'user' as const, content: buildPrioritizePrompt(input) }]
      const response = await callClaude(messages, {
        workspaceId:  input.workspaceId,
        maxTokens:    2048,
        timeoutMs:    30_000,
        systemPrompt: SYSTEM_PROMPT,
      })

      let parsed: PrioritizeOutput
      try {
        parsed = JSON.parse(response.content) as PrioritizeOutput
        validate(PrioritizeOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for prioritize')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      const inputIds  = new Set(input.tasks.map(t => t.id))
      const outputIds = new Set(parsed.ordered.map(t => t.id))
      const idsMatch  = inputIds.size === outputIds.size && [...inputIds].every(id => outputIds.has(id))

      if (!idsMatch) {
        logger.error(
          { inputIds: [...inputIds], outputIds: [...outputIds] },
          'Claude returned mismatched task IDs for prioritize',
        )
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unexpected task IDs in priority response')
      }

      res.json({ data: parsed })
    }),
  )

  return router
}
