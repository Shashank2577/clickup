import { Router } from 'express';
import { z } from 'zod';
import { ErrorCode } from '@clickup/contracts';
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk';
import { callClaude } from '../llm/client.js';
const DocGenerationInputSchema = z.object({
    prompt: z.string().min(1),
    docType: z.enum(['spec', 'readme', 'meeting_notes', 'project_plan', 'retrospective', 'general']),
    workspaceContext: z.string().optional(),
    workspaceId: z.string().uuid(),
});
const SYSTEM_PROMPTS = {
    spec: 'You are a technical writer creating product specifications. Be detailed, precise, and structured. Always return valid JSON.',
    readme: 'You are a developer writing a README file. Be clear, concise, and developer-friendly. Always return valid JSON.',
    meeting_notes: 'You are writing structured meeting notes with action items. Capture key decisions and next steps. Always return valid JSON.',
    project_plan: 'You are creating a project plan document. Include timelines, milestones, and responsibilities. Always return valid JSON.',
    retrospective: 'You are facilitating a sprint retrospective. Highlight what went well, what to improve, and action items. Always return valid JSON.',
    general: 'You are a professional writer. Create well-structured, clear, and engaging content. Always return valid JSON.',
};
export function createDocGenerationRouter() {
    const router = Router();
    router.post('/doc-generate', requireAuth, asyncHandler(async (req, res, _next) => {
        const input = validate(DocGenerationInputSchema, req.body);
        const contextSection = input.workspaceContext
            ? `\n\nContext about the project/team: ${input.workspaceContext}`
            : '';
        const userPrompt = `Create a ${input.docType.replace('_', ' ')} document for the following:${contextSection}\n\nRequest: ${input.prompt}\n\nReturn a JSON object with: title (string), content (full markdown content), outline (array of section heading strings).`;
        const messages = [{ role: 'user', content: userPrompt }];
        const response = await callClaude(messages, {
            workspaceId: input.workspaceId,
            maxTokens: 4000,
            temperature: 0.5,
            timeoutMs: 60_000,
            systemPrompt: SYSTEM_PROMPTS[input.docType],
        });
        let parsed;
        try {
            // Claude sometimes wraps JSON in markdown code fences — strip them
            const raw = response.content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
            parsed = JSON.parse(raw);
            if (!parsed.title || !parsed.content || !Array.isArray(parsed.outline)) {
                throw new Error('Missing required fields');
            }
        }
        catch (err) {
            logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for doc-generate');
            throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON');
        }
        res.json({ data: parsed });
    }));
    return router;
}
//# sourceMappingURL=doc-generation.handler.js.map