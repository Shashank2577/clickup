import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError, tier2Del, CacheKeys } from '@clickup/sdk'
import { ErrorCode, CreateFavoriteSchema, ReorderFavoritesSchema } from '@clickup/contracts'
import { FavoritesRepository } from './favorites.repository.js'

function toFavoriteDto(row: {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  position: number
  created_at: Date
}) {
  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    position: row.position,
    createdAt: row.created_at.toISOString(),
  }
}

export function favoritesRoutes(db: Pool): Router {
  const router = Router()
  const repository = new FavoritesRepository(db)

  // POST /favorites — add a favorite
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(CreateFavoriteSchema, req.body)

      const exists = await repository.existsFavorite(req.auth.userId, input.itemType, input.itemId)
      if (exists) throw new AppError(ErrorCode.FAVORITE_ALREADY_EXISTS)

      const maxPos = await repository.getMaxPosition(req.auth.userId)
      const favorite = await repository.addFavorite({
        userId: req.auth.userId,
        entityType: input.itemType,
        entityId: input.itemId,
        position: maxPos + 1000,
      })
      await tier2Del(CacheKeys.userFavorites(req.auth.userId))
      res.status(201).json({ data: toFavoriteDto(favorite) })
    }),
  )

  // GET /favorites — list user's favorites
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const favorites = await repository.getFavoritesByUser(req.auth.userId)
      res.json({ data: favorites.map(toFavoriteDto) })
    }),
  )

  // DELETE /favorites/:id — remove favorite
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const favorite = await repository.getFavoriteById(id)
      if (!favorite) throw new AppError(ErrorCode.FAVORITE_NOT_FOUND)
      if (favorite.user_id !== req.auth.userId) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      await repository.deleteFavorite(id)
      await tier2Del(CacheKeys.userFavorites(req.auth.userId))
      res.status(204).end()
    }),
  )

  // PATCH /favorites/reorder — reorder favorites
  router.patch(
    '/reorder',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(ReorderFavoritesSchema, req.body)
      await repository.reorderFavorites(req.auth.userId, input.favoriteIds)
      await tier2Del(CacheKeys.userFavorites(req.auth.userId))
      const favorites = await repository.getFavoritesByUser(req.auth.userId)
      res.json({ data: favorites.map(toFavoriteDto) })
    }),
  )

  return router
}
