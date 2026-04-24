import { z } from 'zod'

const uuid = z.string().uuid()

export const CreateWebhookSchema = z.object({
  workspaceId: uuid,
  name: z.string().min(1).max(200),
  url: z.string().url(),
  secret: z.string().min(8).optional(), // auto-generated if not provided
  events: z.array(z.string().min(1)).min(1).max(50),
})

export const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  secret: z.string().min(8).optional(),
  events: z.array(z.string().min(1)).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
})

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>
