import { z } from 'zod'

export const TrashEntityType = z.enum(['space', 'list', 'folder'])

export const ListTrashSchema = z.object({
  workspaceId: z.string().uuid(),
  entityType: TrashEntityType.optional(),
})

export type ListTrashInput = z.infer<typeof ListTrashSchema>
