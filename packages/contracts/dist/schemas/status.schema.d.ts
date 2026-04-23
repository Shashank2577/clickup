import { z } from 'zod';
export declare const CreateListStatusSchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    isClosed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    color: string;
    isClosed: boolean;
    position?: number | undefined;
}, {
    name: string;
    position?: number | undefined;
    color?: string | undefined;
    isClosed?: boolean | undefined;
}>;
export declare const UpdateListStatusSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    isClosed: z.ZodOptional<z.ZodBoolean>;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    position?: number | undefined;
    color?: string | undefined;
    isClosed?: boolean | undefined;
}, {
    name?: string | undefined;
    position?: number | undefined;
    color?: string | undefined;
    isClosed?: boolean | undefined;
}>;
export type CreateListStatusInput = z.infer<typeof CreateListStatusSchema>;
export type UpdateListStatusInput = z.infer<typeof UpdateListStatusSchema>;
//# sourceMappingURL=status.schema.d.ts.map