import { z } from 'zod';
import { TaskPriority, TaskRelationType } from '../types/enums.js';
export declare const CreateTaskSchema: z.ZodObject<{
    listId: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>>;
    assigneeId: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    estimatedMinutes: z.ZodOptional<z.ZodNumber>;
    sprintPoints: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    listId: string;
    title: string;
    priority: TaskPriority;
    tags: string[];
    parentId?: string | undefined;
    description?: string | undefined;
    status?: string | undefined;
    assigneeId?: string | undefined;
    dueDate?: string | undefined;
    startDate?: string | undefined;
    estimatedMinutes?: number | undefined;
    sprintPoints?: number | undefined;
}, {
    listId: string;
    title: string;
    parentId?: string | undefined;
    description?: string | undefined;
    status?: string | undefined;
    priority?: TaskPriority | undefined;
    assigneeId?: string | undefined;
    dueDate?: string | undefined;
    startDate?: string | undefined;
    estimatedMinutes?: number | undefined;
    sprintPoints?: number | undefined;
    tags?: string[] | undefined;
}>;
export declare const UpdateTaskSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    assigneeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    estimatedMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sprintPoints: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    status?: string | undefined;
    priority?: TaskPriority | undefined;
    assigneeId?: string | null | undefined;
    dueDate?: string | null | undefined;
    startDate?: string | null | undefined;
    estimatedMinutes?: number | null | undefined;
    sprintPoints?: number | null | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    status?: string | undefined;
    priority?: TaskPriority | undefined;
    assigneeId?: string | null | undefined;
    dueDate?: string | null | undefined;
    startDate?: string | null | undefined;
    estimatedMinutes?: number | null | undefined;
    sprintPoints?: number | null | undefined;
}>;
export declare const MoveTaskSchema: z.ZodObject<{
    listId: z.ZodString;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    listId: string;
    parentId?: string | null | undefined;
    position?: number | undefined;
}, {
    listId: string;
    parentId?: string | null | undefined;
    position?: number | undefined;
}>;
export declare const AddTaskTagSchema: z.ZodObject<{
    tag: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tag: string;
}, {
    tag: string;
}>;
export declare const AddTaskRelationSchema: z.ZodObject<{
    relatedTaskId: z.ZodString;
    type: z.ZodNativeEnum<typeof TaskRelationType>;
}, "strip", z.ZodTypeAny, {
    type: TaskRelationType;
    relatedTaskId: string;
}, {
    type: TaskRelationType;
    relatedTaskId: string;
}>;
export declare const CreateChecklistSchema: z.ZodObject<{
    title: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
}, {
    title?: string | undefined;
}>;
export declare const CreateChecklistItemSchema: z.ZodObject<{
    title: z.ZodString;
    assigneeId: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    assigneeId?: string | undefined;
    dueDate?: string | undefined;
}, {
    title: string;
    assigneeId?: string | undefined;
    dueDate?: string | undefined;
}>;
export declare const UpdateChecklistItemSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    completed: z.ZodOptional<z.ZodBoolean>;
    assigneeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    completed?: boolean | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    dueDate?: string | null | undefined;
}, {
    completed?: boolean | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    dueDate?: string | null | undefined;
}>;
export declare const TaskListQuerySchema: z.ZodObject<{
    listId: z.ZodString;
    status: z.ZodOptional<z.ZodString>;
    assigneeId: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    dueBefore: z.ZodOptional<z.ZodString>;
    dueAfter: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    includeSubtasks: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    listId: string;
    page: number;
    pageSize: number;
    includeSubtasks: boolean;
    status?: string | undefined;
    priority?: TaskPriority | undefined;
    assigneeId?: string | undefined;
    tags?: string[] | undefined;
    dueBefore?: string | undefined;
    dueAfter?: string | undefined;
}, {
    listId: string;
    status?: string | undefined;
    priority?: TaskPriority | undefined;
    assigneeId?: string | undefined;
    tags?: string[] | undefined;
    dueBefore?: string | undefined;
    dueAfter?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    includeSubtasks?: boolean | undefined;
}>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
//# sourceMappingURL=task.schema.d.ts.map