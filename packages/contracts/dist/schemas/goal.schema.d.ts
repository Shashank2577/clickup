import { z } from 'zod';
export declare const CreateGoalSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    workspaceId: string;
    description?: string | null | undefined;
    dueDate?: string | null | undefined;
    color?: string | undefined;
}, {
    name: string;
    workspaceId: string;
    description?: string | null | undefined;
    dueDate?: string | null | undefined;
    color?: string | undefined;
}>;
export type CreateGoalSchemaType = z.infer<typeof CreateGoalSchema>;
export declare const UpdateGoalSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    dueDate?: string | null | undefined;
    color?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    dueDate?: string | null | undefined;
    color?: string | undefined;
}>;
export type UpdateGoalSchemaType = z.infer<typeof UpdateGoalSchema>;
export declare const CreateGoalTargetSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["number", "currency", "boolean", "task"]>;
    targetValue: z.ZodOptional<z.ZodNumber>;
    taskId: z.ZodOptional<z.ZodString>;
    currentValue: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "number" | "boolean" | "currency" | "task";
    taskId?: string | undefined;
    targetValue?: number | undefined;
    currentValue?: number | undefined;
}, {
    name: string;
    type: "number" | "boolean" | "currency" | "task";
    taskId?: string | undefined;
    targetValue?: number | undefined;
    currentValue?: number | undefined;
}>;
export type CreateGoalTargetSchemaType = z.infer<typeof CreateGoalTargetSchema>;
export declare const UpdateGoalTargetSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    currentValue: z.ZodOptional<z.ZodNumber>;
    targetValue: z.ZodOptional<z.ZodNumber>;
    taskId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    taskId?: string | undefined;
    targetValue?: number | undefined;
    currentValue?: number | undefined;
}, {
    name?: string | undefined;
    taskId?: string | undefined;
    targetValue?: number | undefined;
    currentValue?: number | undefined;
}>;
export type UpdateGoalTargetSchemaType = z.infer<typeof UpdateGoalTargetSchema>;
//# sourceMappingURL=goal.schema.d.ts.map