import { z } from 'zod'

const uuid = z.string().uuid()

export const CreateListStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
  isClosed: z.boolean().optional().default(false),
  position: z.number().int().nonnegative().optional(),
})

export const UpdateListStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isClosed: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
})

export type CreateListStatusInput = z.infer<typeof CreateListStatusSchema>
export type UpdateListStatusInput = z.infer<typeof UpdateListStatusSchema>
