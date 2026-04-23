import { z } from 'zod';
export declare const CreateWebhookSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    secret: z.ZodOptional<z.ZodString>;
    events: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    url: string;
    name: string;
    workspaceId: string;
    events: string[];
    secret?: string | undefined;
}, {
    url: string;
    name: string;
    workspaceId: string;
    events: string[];
    secret?: string | undefined;
}>;
export declare const UpdateWebhookSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    secret: z.ZodOptional<z.ZodString>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    url?: string | undefined;
    name?: string | undefined;
    secret?: string | undefined;
    events?: string[] | undefined;
    isActive?: boolean | undefined;
}, {
    url?: string | undefined;
    name?: string | undefined;
    secret?: string | undefined;
    events?: string[] | undefined;
    isActive?: boolean | undefined;
}>;
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
//# sourceMappingURL=webhook.schema.d.ts.map