import { z } from 'zod';
export declare const CreateSavedSearchSchema: z.ZodObject<{
    name: z.ZodString;
    query: z.ZodString;
    filters: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    workspaceId: string;
    filters: Record<string, unknown>;
    query: string;
}, {
    name: string;
    workspaceId: string;
    query: string;
    filters?: Record<string, unknown> | undefined;
}>;
export declare const UpdateSavedSearchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    filters?: Record<string, unknown> | undefined;
    query?: string | undefined;
}, {
    name?: string | undefined;
    filters?: Record<string, unknown> | undefined;
    query?: string | undefined;
}>;
//# sourceMappingURL=savedsearch.schema.d.ts.map