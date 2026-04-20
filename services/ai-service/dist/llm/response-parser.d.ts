import { type ZodTypeAny, z } from 'zod';
/**
 * Parses Claude's response as JSON and validates against a Zod schema.
 * If parsing fails: logs the raw response and throws AI_INVALID_RESPONSE.
 *
 * @param rawContent - The raw text from Claude's response
 * @param schema - The Zod schema the output must match
 * @param capability - Name of the AI capability (for logging)
 */
export declare function parseAiResponse<T>(rawContent: string, schema: ZodTypeAny, capability: string): T;
export declare const TaskBreakdownOutputSchema: z.ZodObject<{
    subtasks: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        estimatedHours: z.ZodOptional<z.ZodNumber>;
    }, "strip", ZodTypeAny, {
        title: string;
        description?: string | undefined;
        estimatedHours?: number | undefined;
    }, {
        title: string;
        description?: string | undefined;
        estimatedHours?: number | undefined;
    }>, "many">;
    summary: z.ZodString;
}, "strip", ZodTypeAny, {
    subtasks: {
        title: string;
        description?: string | undefined;
        estimatedHours?: number | undefined;
    }[];
    summary: string;
}, {
    subtasks: {
        title: string;
        description?: string | undefined;
        estimatedHours?: number | undefined;
    }[];
    summary: string;
}>;
export declare const SummarizeOutputSchema: z.ZodObject<{
    summary: z.ZodString;
    keyPoints: z.ZodArray<z.ZodString, "many">;
    actionItems: z.ZodArray<z.ZodString, "many">;
}, "strip", ZodTypeAny, {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
}, {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
}>;
export declare const PrioritizeOutputSchema: z.ZodObject<{
    orderedTaskIds: z.ZodArray<z.ZodString, "many">;
    reasoning: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", ZodTypeAny, {
    orderedTaskIds: string[];
    reasoning: Record<string, string>;
}, {
    orderedTaskIds: string[];
    reasoning: Record<string, string>;
}>;
export declare const DailyPlanOutputSchema: z.ZodObject<{
    schedule: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        title: z.ZodString;
        estimatedHours: z.ZodNumber;
        startTime: z.ZodString;
    }, "strip", ZodTypeAny, {
        title: string;
        estimatedHours: number;
        taskId: string;
        startTime: string;
    }, {
        title: string;
        estimatedHours: number;
        taskId: string;
        startTime: string;
    }>, "many">;
    totalScheduledHours: z.ZodNumber;
    isOverloaded: z.ZodBoolean;
    droppedTaskIds: z.ZodArray<z.ZodString, "many">;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", ZodTypeAny, {
    schedule: {
        title: string;
        estimatedHours: number;
        taskId: string;
        startTime: string;
    }[];
    totalScheduledHours: number;
    isOverloaded: boolean;
    droppedTaskIds: string[];
    notes?: string | undefined;
}, {
    schedule: {
        title: string;
        estimatedHours: number;
        taskId: string;
        startTime: string;
    }[];
    totalScheduledHours: number;
    isOverloaded: boolean;
    droppedTaskIds: string[];
    notes?: string | undefined;
}>;
//# sourceMappingURL=response-parser.d.ts.map