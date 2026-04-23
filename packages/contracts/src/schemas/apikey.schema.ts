import { z } from 'zod'

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1).default(['read']),
  expiresAt: z.string().datetime().optional(),
})

export const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
})
