import { z } from 'zod'

export const PresenceStatus = z.enum(['online', 'away', 'offline', 'dnd'])

export const UpdatePresenceSchema = z.object({
  status: PresenceStatus,
})

export const GetPresenceSchema = z.object({
  userIds: z.string().transform((s) => s.split(',').map((id) => id.trim())).pipe(
    z.array(z.string().uuid()).min(1).max(100),
  ),
})

export type UpdatePresenceInput = z.infer<typeof UpdatePresenceSchema>
