import { z } from 'zod'

export const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(500),
  filters: z.record(z.unknown()).optional().default({}),
  workspaceId: z.string().uuid(),
})

export const UpdateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  query: z.string().min(1).max(500).optional(),
  filters: z.record(z.unknown()).optional(),
})
