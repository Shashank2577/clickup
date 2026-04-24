import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  timezone: z.string().optional().default('UTC'),
})

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/)
      .regex(/[0-9]/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const BatchGetUsersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type BatchGetUsersInput = z.infer<typeof BatchGetUsersSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>
