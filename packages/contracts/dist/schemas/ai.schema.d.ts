import { z } from 'zod';
import { SummarizeTargetType } from '../types/enums.js';
export declare const TaskBreakdownInputSchema: z.ZodObject<{
    input: z.ZodString;
    workspaceId: z.ZodString;
    listId: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        existingTasks: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        projectDescription: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        existingTasks?: string[] | undefined;
        projectDescription?: string | undefined;
    }, {
        existingTasks?: string[] | undefined;
        projectDescription?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    listId: string;
    input: string;
    context?: {
        existingTasks?: string[] | undefined;
        projectDescription?: string | undefined;
    } | undefined;
}, {
    workspaceId: string;
    listId: string;
    input: string;
    context?: {
        existingTasks?: string[] | undefined;
        projectDescription?: string | undefined;
    } | undefined;
}>;
export declare const TaskBreakdownOutputSchema: z.ZodObject<{
    tasks: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        estimatedMinutes: z.ZodOptional<z.ZodNumber>;
        subtasks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            estimatedMinutes: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            estimatedMinutes?: number | undefined;
        }, {
            title: string;
            estimatedMinutes?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description?: string | undefined;
        estimatedMinutes?: number | undefined;
        subtasks?: {
            title: string;
            estimatedMinutes?: number | undefined;
        }[] | undefined;
    }, {
        title: string;
        description?: string | undefined;
        estimatedMinutes?: number | undefined;
        subtasks?: {
            title: string;
            estimatedMinutes?: number | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tasks: {
        title: string;
        description?: string | undefined;
        estimatedMinutes?: number | undefined;
        subtasks?: {
            title: string;
            estimatedMinutes?: number | undefined;
        }[] | undefined;
    }[];
}, {
    tasks: {
        title: string;
        description?: string | undefined;
        estimatedMinutes?: number | undefined;
        subtasks?: {
            title: string;
            estimatedMinutes?: number | undefined;
        }[] | undefined;
    }[];
}>;
export declare const SummarizeInputSchema: z.ZodObject<{
    content: z.ZodString;
    type: z.ZodNativeEnum<typeof SummarizeTargetType>;
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: SummarizeTargetType;
    workspaceId: string;
    content: string;
}, {
    type: SummarizeTargetType;
    workspaceId: string;
    content: string;
}>;
export declare const SummarizeOutputSchema: z.ZodObject<{
    summary: z.ZodString;
    keyPoints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    keyPoints?: string[] | undefined;
}, {
    summary: string;
    keyPoints?: string[] | undefined;
}>;
export declare const PrioritizeInputSchema: z.ZodObject<{
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        dueDate: z.ZodNullable<z.ZodString>;
        estimatedMinutes: z.ZodNullable<z.ZodNumber>;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        estimatedMinutes: number | null;
    }, {
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        estimatedMinutes: number | null;
    }>, "many">;
    workspaceId: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    tasks: {
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        estimatedMinutes: number | null;
    }[];
    userId: string;
}, {
    workspaceId: string;
    tasks: {
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        estimatedMinutes: number | null;
    }[];
    userId: string;
}>;
export declare const PrioritizeOutputSchema: z.ZodObject<{
    ordered: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reasoning: string;
    }, {
        id: string;
        reasoning: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    ordered: {
        id: string;
        reasoning: string;
    }[];
}, {
    ordered: {
        id: string;
        reasoning: string;
    }[];
}>;
export declare const DailyPlanInputSchema: z.ZodObject<{
    userId: z.ZodString;
    workspaceId: z.ZodString;
    date: z.ZodString;
    availableMinutes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    date: string;
    workspaceId: string;
    userId: string;
    availableMinutes: number;
}, {
    date: string;
    workspaceId: string;
    userId: string;
    availableMinutes?: number | undefined;
}>;
export declare const DailyPlanOutputSchema: z.ZodObject<{
    plan: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        taskTitle: z.ZodString;
        suggestedStartTime: z.ZodOptional<z.ZodString>;
        estimatedMinutes: z.ZodNumber;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        estimatedMinutes: number;
        reasoning: string;
        taskId: string;
        taskTitle: string;
        suggestedStartTime?: string | undefined;
    }, {
        estimatedMinutes: number;
        reasoning: string;
        taskId: string;
        taskTitle: string;
        suggestedStartTime?: string | undefined;
    }>, "many">;
    totalMinutes: z.ZodNumber;
    overloadWarning: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    plan: {
        estimatedMinutes: number;
        reasoning: string;
        taskId: string;
        taskTitle: string;
        suggestedStartTime?: string | undefined;
    }[];
    totalMinutes: number;
    overloadWarning: boolean;
}, {
    plan: {
        estimatedMinutes: number;
        reasoning: string;
        taskId: string;
        taskTitle: string;
        suggestedStartTime?: string | undefined;
    }[];
    totalMinutes: number;
    overloadWarning: boolean;
}>;
export type TaskBreakdownInput = z.infer<typeof TaskBreakdownInputSchema>;
export type TaskBreakdownOutput = z.infer<typeof TaskBreakdownOutputSchema>;
export type SummarizeInput = z.infer<typeof SummarizeInputSchema>;
export type SummarizeOutput = z.infer<typeof SummarizeOutputSchema>;
export type PrioritizeInput = z.infer<typeof PrioritizeInputSchema>;
export type PrioritizeOutput = z.infer<typeof PrioritizeOutputSchema>;
export type DailyPlanInput = z.infer<typeof DailyPlanInputSchema>;
export type DailyPlanOutput = z.infer<typeof DailyPlanOutputSchema>;
//# sourceMappingURL=ai.schema.d.ts.map