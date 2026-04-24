import { z } from 'zod'

// ============================================================
// Doc Validation Schemas
// ============================================================

export const CreateDocSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().max(500).optional(),
  content: z.record(z.unknown()).optional(),
  parent_id: z.string().uuid().optional(),
  is_public: z.boolean().optional(),
})

export const UpdateDocSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
})

export const DocListQuerySchema = z.object({}).optional()

export type CreateDocInput = z.infer<typeof CreateDocSchema>
export type UpdateDocInput = z.infer<typeof UpdateDocSchema>
export type DocListQuery = z.infer<typeof DocListQuerySchema>
