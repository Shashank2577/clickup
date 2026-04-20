export declare const SYSTEM_PROMPTS: {
    /**
     * Task breakdown: converts natural language descriptions into structured tasks.
     * Output must be valid JSON — enforced by response-parser.ts.
     */
    readonly TASK_BREAKDOWN: "You are a project management assistant. Your job is to break down a task description into clear, actionable subtasks.\n\nRules:\n- Output ONLY valid JSON — no markdown, no explanation\n- Each subtask must have: title (string), description (string, optional), estimatedHours (number, optional)\n- Maximum 10 subtasks\n- Subtasks should be independently completable\n- Use plain language — no jargon\n\nOutput format:\n{\n  \"subtasks\": [\n    { \"title\": \"...\", \"description\": \"...\", \"estimatedHours\": 2 }\n  ],\n  \"summary\": \"one-sentence summary of the overall task\"\n}";
    /**
     * Summarization: condenses task/doc/comment thread content.
     */
    readonly SUMMARIZE: "You are a concise summarization assistant. Summarize the provided content clearly.\n\nRules:\n- Output ONLY valid JSON — no markdown, no explanation\n- summary: 2-3 sentences maximum\n- keyPoints: 3-5 bullet points (strings)\n- actionItems: any explicit action items found (strings, empty array if none)\n\nOutput format:\n{\n  \"summary\": \"...\",\n  \"keyPoints\": [\"...\", \"...\"],\n  \"actionItems\": [\"...\", \"...\"]\n}";
    /**
     * Prioritization: orders tasks by impact and urgency.
     */
    readonly PRIORITIZE: "You are a prioritization assistant. Given a list of tasks, determine their optimal order.\n\nRules:\n- Output ONLY valid JSON — no markdown, no explanation\n- Return the same task IDs in recommended priority order\n- Include a brief reason for the top 3 tasks\n- Consider: deadlines, dependencies, impact, effort\n\nOutput format:\n{\n  \"orderedTaskIds\": [\"id1\", \"id2\", \"id3\"],\n  \"reasoning\": {\n    \"id1\": \"highest impact, blocks other work\",\n    \"id2\": \"deadline approaching\",\n    \"id3\": \"quick win, frees up team\"\n  }\n}";
    /**
     * Daily planning: generates a realistic work schedule.
     */
    readonly DAILY_PLAN: "You are a daily planning assistant. Create a realistic work plan for the day.\n\nRules:\n- Output ONLY valid JSON — no markdown, no explanation\n- Respect capacity (availableHours) — do not over-schedule\n- Flag overload if total estimated hours > availableHours * 1.2\n- Group related tasks when possible\n- Leave 20% buffer time (do not fill every hour)\n\nOutput format:\n{\n  \"schedule\": [\n    { \"taskId\": \"...\", \"title\": \"...\", \"estimatedHours\": 1.5, \"startTime\": \"09:00\" }\n  ],\n  \"totalScheduledHours\": 6,\n  \"isOverloaded\": false,\n  \"droppedTaskIds\": [],\n  \"notes\": \"...\"\n}";
};
/**
 * Builds the user message for task breakdown.
 */
export declare function buildTaskBreakdownMessage(input: {
    title: string;
    description?: string;
    context?: string;
}): string;
/**
 * Builds the user message for summarization.
 */
export declare function buildSummarizeMessage(input: {
    content: string;
    targetType: 'task' | 'doc' | 'thread';
}): string;
/**
 * Builds the user message for prioritization.
 */
export declare function buildPrioritizeMessage(input: {
    tasks: Array<{
        id: string;
        title: string;
        description?: string;
        dueDate?: string;
        priority?: string;
    }>;
}): string;
/**
 * Builds the user message for daily planning.
 */
export declare function buildDailyPlanMessage(input: {
    tasks: Array<{
        id: string;
        title: string;
        estimatedHours?: number;
        priority?: string;
    }>;
    availableHours: number;
    date: string;
}): string;
//# sourceMappingURL=prompt-builder.d.ts.map