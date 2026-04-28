import { z } from 'zod'

export const TrashEntityType = z.enum(['space', 'list', 'folder'])

export const ListTrashSchema = z.object({
  workspaceId: z.string().min(1),
  entityType: TrashEntityType.optional(),
})

export type ListTrashInput = z.infer<typeof ListTrashSchema>
