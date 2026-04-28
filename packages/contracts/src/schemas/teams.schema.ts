import { z } from 'zod'

export const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional(),
  workspaceId: z.string().min(1),
})

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
})

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid(),
})

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>
export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>
