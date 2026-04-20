import { z } from 'zod'

const uuid = z.string().uuid()

export const CreateCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(10000, 'Comment too long'),
  parentId: uuid.optional(),
})

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const AddReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>
