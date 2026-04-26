import { z } from 'zod'

export const FavoriteEntityType = z.enum(['task', 'space', 'doc', 'dashboard', 'view'])

export const AddFavoriteSchema = z.object({
  entityType: FavoriteEntityType,
  entityId: z.string().uuid(),
})

export const ReorderFavoritesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
})

export type AddFavoriteInput = z.infer<typeof AddFavoriteSchema>
export type ReorderFavoritesInput = z.infer<typeof ReorderFavoritesSchema>
