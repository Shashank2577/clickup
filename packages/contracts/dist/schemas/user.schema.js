"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchGetUsersSchema = exports.ChangePasswordSchema = exports.UpdateProfileSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').toLowerCase(),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    name: zod_1.z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
    timezone: zod_1.z.string().optional().default('UTC'),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase(),
    password: zod_1.z.string().min(1),
});
exports.UpdateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    timezone: zod_1.z.string().optional(),
});
exports.ChangePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z
        .string()
        .min(8)
        .max(128)
        .regex(/[A-Z]/)
        .regex(/[0-9]/),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
exports.BatchGetUsersSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
});
//# sourceMappingURL=user.schema.js.map