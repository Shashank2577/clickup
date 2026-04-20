// src/llm/prompt-builder.ts
// Builds system prompts and user messages for each AI capability.
// All prompts are centralized here — never inline prompts in capability handlers.
//
// IMPORTANT: Prompts are carefully tuned. Do not modify without testing outputs.
export const SYSTEM_PROMPTS = {
    /**
     * Task breakdown: converts natural language descriptions into structured tasks.
     * Output must be valid JSON — enforced by response-parser.ts.
     */
    TASK_BREAKDOWN: `You are a project management assistant. Your job is to break down a task description into clear, actionable subtasks.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- Each subtask must have: title (string), description (string, optional), estimatedHours (number, optional)
- Maximum 10 subtasks
- Subtasks should be independently completable
- Use plain language — no jargon

Output format:
{
  "subtasks": [
    { "title": "...", "description": "...", "estimatedHours": 2 }
  ],
  "summary": "one-sentence summary of the overall task"
}`,
    /**
     * Summarization: condenses task/doc/comment thread content.
     */
    SUMMARIZE: `You are a concise summarization assistant. Summarize the provided content clearly.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- summary: 2-3 sentences maximum
- keyPoints: 3-5 bullet points (strings)
- actionItems: any explicit action items found (strings, empty array if none)

Output format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "actionItems": ["...", "..."]
}`,
    /**
     * Prioritization: orders tasks by impact and urgency.
     */
    PRIORITIZE: `You are a prioritization assistant. Given a list of tasks, determine their optimal order.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- Return the same task IDs in recommended priority order
- Include a brief reason for the top 3 tasks
- Consider: deadlines, dependencies, impact, effort

Output format:
{
  "orderedTaskIds": ["id1", "id2", "id3"],
  "reasoning": {
    "id1": "highest impact, blocks other work",
    "id2": "deadline approaching",
    "id3": "quick win, frees up team"
  }
}`,
    /**
     * Daily planning: generates a realistic work schedule.
     */
    DAILY_PLAN: `You are a daily planning assistant. Create a realistic work plan for the day.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- Respect capacity (availableHours) — do not over-schedule
- Flag overload if total estimated hours > availableHours * 1.2
- Group related tasks when possible
- Leave 20% buffer time (do not fill every hour)

Output format:
{
  "schedule": [
    { "taskId": "...", "title": "...", "estimatedHours": 1.5, "startTime": "09:00" }
  ],
  "totalScheduledHours": 6,
  "isOverloaded": false,
  "droppedTaskIds": [],
  "notes": "..."
}`,
};
/**
 * Builds the user message for task breakdown.
 */
export function buildTaskBreakdownMessage(input) {
    return [
        `Task: ${input.title}`,
        input.description ? `\nDescription: ${input.description}` : '',
        input.context ? `\nAdditional context: ${input.context}` : '',
        '\nBreak this down into subtasks.',
    ].join('');
}
/**
 * Builds the user message for summarization.
 */
export function buildSummarizeMessage(input) {
    return `Summarize this ${input.targetType}:\n\n${input.content}`;
}
/**
 * Builds the user message for prioritization.
 */
export function buildPrioritizeMessage(input) {
    const taskList = input.tasks
        .map(t => `- ID: ${t.id} | ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`)
        .join('\n');
    return `Prioritize these ${input.tasks.length} tasks:\n\n${taskList}`;
}
/**
 * Builds the user message for daily planning.
 */
export function buildDailyPlanMessage(input) {
    const taskList = input.tasks
        .map(t => `- ID: ${t.id} | ${t.title} | ~${t.estimatedHours ?? 1}h | priority: ${t.priority ?? 'none'}`)
        .join('\n');
    return `Create a daily plan for ${input.date}.\nAvailable hours: ${input.availableHours}\n\nTasks to schedule:\n${taskList}`;
}
//# sourceMappingURL=prompt-builder.js.map