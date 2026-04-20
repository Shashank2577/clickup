"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateListSchema = exports.CreateListSchema = exports.UpdateSpaceSchema = exports.CreateSpaceSchema = exports.UpdateMemberRoleSchema = exports.InviteMemberSchema = exports.UpdateWorkspaceSchema = exports.CreateWorkspaceSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../types/enums.js");
const uuid = zod_1.z.string().uuid();
exports.CreateWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100).trim(),
    slug: zod_1.z
        .string()
        .min(2, 'Slug must be at least 2 characters')
        .max(50)
        .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens')
        .toLowerCase(),
});
exports.UpdateWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    logoUrl: zod_1.z.string().url().nullable().optional(),
});
exports.InviteMemberSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase(),
    role: zod_1.z.nativeEnum(enums_js_1.UserRole).refine((r) => r !== enums_js_1.UserRole.Owner, {
        message: 'Cannot invite as owner',
    }),
});
exports.UpdateMemberRoleSchema = zod_1.z.object({
    role: zod_1.z.nativeEnum(enums_js_1.UserRole).refine((r) => r !== enums_js_1.UserRole.Owner, {
        message: 'Cannot update to owner role',
    }),
});
exports.CreateSpaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    color: zod_1.z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
        .optional()
        .default('#6366f1'),
    icon: zod_1.z.string().max(10).optional(),
    isPrivate: zod_1.z.boolean().optional().default(false),
});
exports.UpdateSpaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    color: zod_1.z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    icon: zod_1.z.string().max(10).nullable().optional(),
    isPrivate: zod_1.z.boolean().optional(),
});
exports.CreateListSchema = zod_1.z.object({
    spaceId: uuid,
    name: zod_1.z.string().min(1).max(100).trim(),
    color: zod_1.z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable()
        .optional(),
});
exports.UpdateListSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    color: zod_1.z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable()
        .optional(),
    isArchived: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=workspace.schema.js.map