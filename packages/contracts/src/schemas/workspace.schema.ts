import { z } from 'zod'
import { UserRole } from '../types/enums.js'

const uuid = z.string().uuid()

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens')
    .toLowerCase(),
})

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  logoUrl: z.string().url().nullable().optional(),
})

export const InviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.nativeEnum(UserRole).refine((r) => r !== UserRole.Owner, {
    message: 'Cannot invite as owner',
  }),
})

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole).refine((r) => r !== UserRole.Owner, {
    message: 'Cannot update to owner role',
  }),
})

export const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#6366f1'),
  icon: z.string().max(10).optional(),
  isPrivate: z.boolean().optional().default(false),
})

export const UpdateSpaceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(10).nullable().optional(),
  isPrivate: z.boolean().optional(),
})

export const CreateListSchema = z.object({
  spaceId: uuid,
  name: z.string().min(1).max(100).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
})

export const UpdateListSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  isArchived: z.boolean().optional(),
})

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>
export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>
export type CreateListInput = z.infer<typeof CreateListSchema>
