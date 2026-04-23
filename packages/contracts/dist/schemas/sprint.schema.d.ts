import { z } from 'zod';
export declare const CreateSprintSchema: z.ZodObject<{
    name: z.ZodString;
    goal: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    startDate?: string | undefined;
    goal?: string | undefined;
    endDate?: string | undefined;
}, {
    name: string;
    startDate?: string | undefined;
    goal?: string | undefined;
    endDate?: string | undefined;
}>;
export type CreateSprintSchemaType = z.infer<typeof CreateSprintSchema>;
export declare const UpdateSprintSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    goal: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    startDate?: string | undefined;
    goal?: string | undefined;
    endDate?: string | undefined;
}, {
    name?: string | undefined;
    startDate?: string | undefined;
    goal?: string | undefined;
    endDate?: string | undefined;
}>;
export type UpdateSprintSchemaType = z.infer<typeof UpdateSprintSchema>;
export declare const AddSprintTasksSchema: z.ZodObject<{
    taskIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    taskIds: string[];
}, {
    taskIds: string[];
}>;
export type AddSprintTasksSchemaType = z.infer<typeof AddSprintTasksSchema>;
//# sourceMappingURL=sprint.schema.d.ts.map