import { z } from 'zod'

export const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'guest']).default('member'),
})

export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
})
