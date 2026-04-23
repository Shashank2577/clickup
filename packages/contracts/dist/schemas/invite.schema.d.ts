import { z } from 'zod';
export declare const CreateInviteSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["admin", "member", "guest"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "admin" | "member" | "guest";
}, {
    email: string;
    role?: "admin" | "member" | "guest" | undefined;
}>;
export declare const AcceptInviteSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
//# sourceMappingURL=invite.schema.d.ts.map