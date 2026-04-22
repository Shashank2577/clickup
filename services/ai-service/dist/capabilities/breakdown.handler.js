import { Router } from 'express';
import { TaskBreakdownInputSchema, TaskBreakdownOutputSchema, ErrorCode, } from '@clickup/contracts';
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk';
import { callClaude } from '../llm/client.js';
import { buildBreakdownPrompt } from '../prompts/breakdown.prompt.js';
const SYSTEM_PROMPT = `You are a project management AI. Break down the following task description into smaller, actionable subtasks. Return JSON matching this schema: { tasks: [{ title: string, description?: string, estimatedMinutes?: number, subtasks?: [{ title: string, estimatedMinutes?: number }] }] }`;
export function createBreakdownRouter() {
    const router = Router();
    router.post('/api/v1/ai/task-breakdown', requireAuth, asyncHandler(async (req, res, _next) => {
        const input = validate(TaskBreakdownInputSchema, req.body);
        const messages = [{ role: 'user', content: buildBreakdownPrompt(input) }];
        const response = await callClaude(messages, {
            workspaceId: input.workspaceId,
            maxTokens: 2048,
            timeoutMs: 30_000,
            systemPrompt: SYSTEM_PROMPT,
        });
        let parsed;
        try {
            parsed = JSON.parse(response.content);
            validate(TaskBreakdownOutputSchema, parsed);
        }
        catch (err) {
            logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for task-breakdown');
            throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON');
        }
        res.json({ data: parsed });
    }));
    return router;
}
//# sourceMappingURL=breakdown.handler.js.map