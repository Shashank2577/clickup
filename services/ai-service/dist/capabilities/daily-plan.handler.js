import { Router } from 'express';
import { DailyPlanInputSchema, DailyPlanOutputSchema, ErrorCode, } from '@clickup/contracts';
import { requireAuth, asyncHandler, validate, AppError, logger, createServiceClient } from '@clickup/sdk';
import { callClaude } from '../llm/client.js';
import { buildDailyPlanPrompt } from '../prompts/daily-plan.prompt.js';
const SYSTEM_PROMPT = `Given these tasks and the available minutes today, create an optimal work plan. Return JSON: { plan: [{ taskId: string, taskTitle: string, suggestedStartTime?: string, estimatedMinutes: number, reasoning: string }], totalMinutes: number, overloadWarning: boolean }`;
export function createDailyPlanRouter() {
    const router = Router();
    router.post('/daily-plan', requireAuth, asyncHandler(async (req, res, _next) => {
        const input = validate(DailyPlanInputSchema, req.body);
        const rawTraceId = req.headers['x-trace-id'];
        const taskClient = createServiceClient(process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002', ...(typeof rawTraceId === 'string' ? [{ traceId: rawTraceId }] : [{}]));
        const { data: tasks } = await taskClient.get(`/api/v1/users/${input.userId}/tasks?status=incomplete&dueDate=${input.date}`);
        // availableMinutes has .default(480) in schema so it is always defined after validate()
        const inputForPrompt = { ...input, availableMinutes: input.availableMinutes ?? 480 };
        const messages = [{ role: 'user', content: buildDailyPlanPrompt(inputForPrompt, tasks ?? []) }];
        const response = await callClaude(messages, {
            workspaceId: input.workspaceId,
            maxTokens: 2048,
            timeoutMs: 30_000,
            systemPrompt: SYSTEM_PROMPT,
        });
        let parsed;
        try {
            parsed = JSON.parse(response.content);
            validate(DailyPlanOutputSchema, parsed);
        }
        catch (err) {
            logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for daily-plan');
            throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON');
        }
        res.json({ data: parsed });
    }));
    return router;
}
//# sourceMappingURL=daily-plan.handler.js.map