import { z } from 'zod';
export declare const CreateDocSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    parent_id: z.ZodOptional<z.ZodString>;
    is_public: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    title?: string | undefined;
    content?: Record<string, unknown> | undefined;
    parent_id?: string | undefined;
    is_public?: boolean | undefined;
}, {
    workspaceId: string;
    title?: string | undefined;
    content?: Record<string, unknown> | undefined;
    parent_id?: string | undefined;
    is_public?: boolean | undefined;
}>;
export declare const UpdateDocSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    content?: Record<string, unknown> | undefined;
    is_public?: boolean | undefined;
}, {
    title?: string | undefined;
    content?: Record<string, unknown> | undefined;
    is_public?: boolean | undefined;
}>;
export declare const DocListQuerySchema: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>;
export type CreateDocInput = z.infer<typeof CreateDocSchema>;
export type UpdateDocInput = z.infer<typeof UpdateDocSchema>;
export type DocListQuery = z.infer<typeof DocListQuerySchema>;
//# sourceMappingURL=docs.schema.d.ts.map