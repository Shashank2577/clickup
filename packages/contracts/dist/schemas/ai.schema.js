"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanOutputSchema = exports.DailyPlanInputSchema = exports.PrioritizeOutputSchema = exports.PrioritizeInputSchema = exports.SummarizeOutputSchema = exports.SummarizeInputSchema = exports.TaskBreakdownOutputSchema = exports.TaskBreakdownInputSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../types/enums.js");
const uuid = zod_1.z.string().uuid();
// ============================================================
// AI Service Input/Output Schemas
// These define the contract for all AI capabilities.
// Other services call these endpoints — they never call LLMs directly.
// ============================================================
exports.TaskBreakdownInputSchema = zod_1.z.object({
    input: zod_1.z.string().min(1, 'Input is required').max(2000, 'Input too long'),
    workspaceId: uuid,
    listId: uuid,
    context: zod_1.z
        .object({
        existingTasks: zod_1.z.array(zod_1.z.string()).max(20).optional(),
        projectDescription: zod_1.z.string().max(500).optional(),
    })
        .optional(),
});
exports.TaskBreakdownOutputSchema = zod_1.z.object({
    tasks: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        estimatedMinutes: zod_1.z.number().int().positive().optional(),
        subtasks: zod_1.z
            .array(zod_1.z.object({
            title: zod_1.z.string(),
            estimatedMinutes: zod_1.z.number().int().positive().optional(),
        }))
            .optional(),
    })),
});
exports.SummarizeInputSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(20000),
    type: zod_1.z.nativeEnum(enums_js_1.SummarizeTargetType),
    workspaceId: uuid,
});
exports.SummarizeOutputSchema = zod_1.z.object({
    summary: zod_1.z.string(),
    keyPoints: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.PrioritizeInputSchema = zod_1.z.object({
    tasks: zod_1.z.array(zod_1.z.object({
        id: uuid,
        title: zod_1.z.string(),
        dueDate: zod_1.z.string().nullable(),
        estimatedMinutes: zod_1.z.number().nullable(),
        status: zod_1.z.string(),
    })).min(1).max(50),
    workspaceId: uuid,
    userId: uuid,
});
exports.PrioritizeOutputSchema = zod_1.z.object({
    ordered: zod_1.z.array(zod_1.z.object({
        id: uuid,
        reasoning: zod_1.z.string(),
    })),
});
exports.DailyPlanInputSchema = zod_1.z.object({
    userId: uuid,
    workspaceId: uuid,
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
    availableMinutes: zod_1.z.number().int().positive().optional().default(480),
});
exports.DailyPlanOutputSchema = zod_1.z.object({
    plan: zod_1.z.array(zod_1.z.object({
        taskId: uuid,
        taskTitle: zod_1.z.string(),
        suggestedStartTime: zod_1.z.string().optional(),
        estimatedMinutes: zod_1.z.number(),
        reasoning: zod_1.z.string(),
    })),
    totalMinutes: zod_1.z.number(),
    overloadWarning: zod_1.z.boolean(),
});
//# sourceMappingURL=ai.schema.js.map