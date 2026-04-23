import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, asyncHandler, validate, logger } from '@clickup/sdk';
import { callClaude } from '../llm/client.js';
const MeetingNotesInputSchema = z.object({
    transcript: z.string().min(1),
    participants: z.array(z.string()).optional(),
    workspaceId: z.string().uuid(),
});
export function createMeetingNotesRouter() {
    const router = Router();
    router.post('/meeting-notes', requireAuth, asyncHandler(async (req, res, _next) => {
        const input = validate(MeetingNotesInputSchema, req.body);
        const participantsSection = input.participants && input.participants.length > 0
            ? `\n\nParticipants: ${input.participants.join(', ')}`
            : '';
        const userPrompt = `Extract structured information from this meeting transcript. Return JSON with: summary (2-3 sentences), actionItems (array of {description, assignee, dueDate}), decisions (key decisions made), topics (main topics discussed).${participantsSection}\n\nTranscript:\n${input.transcript}`;
        const messages = [{ role: 'user', content: userPrompt }];
        const response = await callClaude(messages, {
            workspaceId: input.workspaceId,
            maxTokens: 3000,
            temperature: 0.2,
            timeoutMs: 30_000,
        });
        let parsed;
        try {
            const raw = response.content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
            const candidate = JSON.parse(raw);
            parsed = {
                summary: candidate.summary ?? '',
                actionItems: Array.isArray(candidate.actionItems) ? candidate.actionItems : [],
                decisions: Array.isArray(candidate.decisions) ? candidate.decisions : [],
                topics: Array.isArray(candidate.topics) ? candidate.topics : [],
            };
        }
        catch (err) {
            // Graceful degradation: return raw as summary if JSON parse fails
            logger.warn({ err, raw: response.content }, 'Claude returned non-JSON for meeting-notes, falling back to raw summary');
            parsed = {
                summary: response.content.trim(),
                actionItems: [],
                decisions: [],
                topics: [],
            };
        }
        res.json({ data: parsed });
    }));
    return router;
}
//# sourceMappingURL=meeting-notes.handler.js.map