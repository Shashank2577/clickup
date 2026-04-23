import { z } from 'zod';
export declare const CreateApiKeySchema: z.ZodObject<{
    name: z.ZodString;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    scopes: string[];
    expiresAt?: string | undefined;
}, {
    name: string;
    scopes?: string[] | undefined;
    expiresAt?: string | undefined;
}>;
export declare const UpdateApiKeySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
//# sourceMappingURL=apikey.schema.d.ts.map