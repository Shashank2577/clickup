import { z } from 'zod';
import { UserRole } from '../types/enums.js';
export declare const CreateWorkspaceSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
}, {
    name: string;
    slug: string;
}>;
export declare const UpdateWorkspaceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    logoUrl?: string | null | undefined;
}, {
    name?: string | undefined;
    logoUrl?: string | null | undefined;
}>;
export declare const InviteMemberSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEffects<z.ZodNativeEnum<typeof UserRole>, UserRole.Admin | UserRole.Member | UserRole.Guest, UserRole>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: UserRole.Admin | UserRole.Member | UserRole.Guest;
}, {
    email: string;
    role: UserRole;
}>;
export declare const UpdateMemberRoleSchema: z.ZodObject<{
    role: z.ZodEffects<z.ZodNativeEnum<typeof UserRole>, UserRole.Admin | UserRole.Member | UserRole.Guest, UserRole>;
}, "strip", z.ZodTypeAny, {
    role: UserRole.Admin | UserRole.Member | UserRole.Guest;
}, {
    role: UserRole;
}>;
export declare const CreateSpaceSchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    icon: z.ZodOptional<z.ZodString>;
    isPrivate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    color: string;
    isPrivate: boolean;
    icon?: string | undefined;
}, {
    name: string;
    color?: string | undefined;
    icon?: string | undefined;
    isPrivate?: boolean | undefined;
}>;
export declare const UpdateSpaceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isPrivate: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    color?: string | undefined;
    icon?: string | null | undefined;
    isPrivate?: boolean | undefined;
}, {
    name?: string | undefined;
    color?: string | undefined;
    icon?: string | null | undefined;
    isPrivate?: boolean | undefined;
}>;
export declare const CreateListSchema: z.ZodObject<{
    spaceId: z.ZodString;
    name: z.ZodString;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    spaceId: string;
    color?: string | null | undefined;
}, {
    name: string;
    spaceId: string;
    color?: string | null | undefined;
}>;
export declare const UpdateListSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isArchived: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    color?: string | null | undefined;
    isArchived?: boolean | undefined;
}, {
    name?: string | undefined;
    color?: string | null | undefined;
    isArchived?: boolean | undefined;
}>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>;
export type CreateListInput = z.infer<typeof CreateListSchema>;
//# sourceMappingURL=workspace.schema.d.ts.map