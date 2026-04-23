import { Router } from 'express';
import { z } from 'zod';
import { ErrorCode } from '@clickup/contracts';
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk';
import { callClaude } from '../llm/client.js';
const WritingAssistantInputSchema = z.object({
    text: z.string().min(1),
    action: z.enum(['improve', 'shorten', 'expand', 'fix_grammar', 'make_formal', 'make_casual', 'translate']),
    targetLanguage: z.string().optional(),
    context: z.string().optional(),
    workspaceId: z.string().uuid(),
});
function buildPrompt(text, action, targetLanguage) {
    switch (action) {
        case 'improve':
            return `Rewrite this text to be clearer and more professional. Keep the same meaning. Return only the rewritten text.\n\nText: ${text}`;
        case 'shorten':
            return `Shorten this text to about half its length while preserving the key points. Return only the shortened text.\n\nText: ${text}`;
        case 'expand':
            return `Expand this text with more detail and explanation. Return only the expanded text.\n\nText: ${text}`;
        case 'fix_grammar':
            return `Fix any grammar, spelling, and punctuation errors in this text. Return only the corrected text.\n\nText: ${text}`;
        case 'make_formal':
            return `Rewrite this text in a formal, professional tone. Return only the rewritten text.\n\nText: ${text}`;
        case 'make_casual':
            return `Rewrite this text in a casual, friendly tone. Return only the rewritten text.\n\nText: ${text}`;
        case 'translate':
            return `Translate this text to ${targetLanguage ?? 'English'}. Return only the translated text.\n\nText: ${text}`;
    }
}
export function createWritingAssistantRouter() {
    const router = Router();
    router.post('/writing-assistant', requireAuth, asyncHandler(async (req, res, _next) => {
        const input = validate(WritingAssistantInputSchema, req.body);
        if (input.action === 'translate' && !input.targetLanguage) {
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'targetLanguage is required for translate action');
        }
        const prompt = buildPrompt(input.text, input.action, input.targetLanguage);
        const messages = [{ role: 'user', content: prompt }];
        const response = await callClaude(messages, {
            workspaceId: input.workspaceId,
            maxTokens: 2000,
            temperature: 0.3,
            timeoutMs: 30_000,
        });
        if (!response.content) {
            logger.error({ raw: response.content }, 'Claude returned empty response for writing-assistant');
            throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned an empty response');
        }
        res.json({ data: { result: response.content.trim(), action: input.action } });
    }));
    return router;
}
//# sourceMappingURL=writing-assistant.handler.js.map