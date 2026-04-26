import { z } from 'zod'

export const FavoriteItemType = z.enum(['task', 'doc', 'list', 'space', 'folder', 'dashboard', 'view', 'goal'])

export const CreateFavoriteSchema = z.object({
  itemType: FavoriteItemType,
  itemId: z.string().uuid(),
  itemName: z.string().min(1).max(255),
})

export const ReorderFavoritesSchema = z.object({
  favoriteIds: z.array(z.string().uuid()).min(1),
})
