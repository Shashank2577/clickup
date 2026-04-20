// src/llm/response-parser.ts
// Parses and validates Claude's JSON output.
// Failure mode 6: if output is unparseable, logs and returns AI_INVALID_RESPONSE.
import { z } from 'zod';
import { AppError, logger } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
/**
 * Parses Claude's response as JSON and validates against a Zod schema.
 * If parsing fails: logs the raw response and throws AI_INVALID_RESPONSE.
 *
 * @param rawContent - The raw text from Claude's response
 * @param schema - The Zod schema the output must match
 * @param capability - Name of the AI capability (for logging)
 */
export function parseAiResponse(rawContent, schema, capability) {
    // Claude sometimes wraps JSON in markdown code fences — strip them
    const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch (err) {
        logger.error({ capability, rawContent, err }, 'Claude returned unparseable JSON');
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, `AI response for "${capability}" was not valid JSON.`);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
        logger.error({ capability, parsed, issues: result.error.issues }, 'Claude response failed schema validation');
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, `AI response for "${capability}" did not match expected structure.`);
    }
    return result.data;
}
// Zod schemas for each capability output
// These mirror the prompt output formats in prompt-builder.ts
export const TaskBreakdownOutputSchema = z.object({
    subtasks: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        estimatedHours: z.number().positive().optional(),
    })).max(10),
    summary: z.string(),
});
export const SummarizeOutputSchema = z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    actionItems: z.array(z.string()),
});
export const PrioritizeOutputSchema = z.object({
    orderedTaskIds: z.array(z.string()),
    reasoning: z.record(z.string(), z.string()),
});
export const DailyPlanOutputSchema = z.object({
    schedule: z.array(z.object({
        taskId: z.string(),
        title: z.string(),
        estimatedHours: z.number(),
        startTime: z.string(),
    })),
    totalScheduledHours: z.number(),
    isOverloaded: z.boolean(),
    droppedTaskIds: z.array(z.string()),
    notes: z.string().optional(),
});
//# sourceMappingURL=response-parser.js.map