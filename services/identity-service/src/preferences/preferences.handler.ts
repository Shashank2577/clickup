import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, tier2Del, tier2Get, tier2Set, CacheKeys } from '@clickup/sdk'
import { UpdateUserPreferencesSchema } from '@clickup/contracts'
import { PreferencesRepository } from './preferences.repository.js'

function toPreferencesDto(row: {
  user_id: string
  accent_color: string
  appearance_mode: string
  high_contrast: boolean
  updated_at: Date
}) {
  return {
    userId: row.user_id,
    accentColor: row.accent_color,
    appearanceMode: row.appearance_mode,
    highContrast: row.high_contrast,
    updatedAt: row.updated_at.toISOString(),
  }
}

const DEFAULT_PREFERENCES = {
  accentColor: '#6366f1',
  appearanceMode: 'auto' as const,
  highContrast: false,
}

export function preferencesRoutes(db: Pool): Router {
  const router = Router()
  const repository = new PreferencesRepository(db)

  // GET /users/me/preferences — get user's theme preferences
  router.get(
    '/me/preferences',
    requireAuth,
    asyncHandler(async (req, res) => {
      const cacheKey = CacheKeys.userPreferences(req.auth.userId)
      const cached = await tier2Get<ReturnType<typeof toPreferencesDto>>(cacheKey)
      if (cached) {
        res.json({ data: cached })
        return
      }

      const prefs = await repository.getPreferences(req.auth.userId)
      if (!prefs) {
        res.json({ data: { userId: req.auth.userId, ...DEFAULT_PREFERENCES, updatedAt: null } })
        return
      }

      const dto = toPreferencesDto(prefs)
      await tier2Set(cacheKey, dto)
      res.json({ data: dto })
    }),
  )

  // PATCH /users/me/preferences — update theme preferences
  router.patch(
    '/me/preferences',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>
      const prefs = await repository.upsertPreferences(req.auth.userId, {
        accentColor: body['accentColor'] as string | undefined,
        appearanceMode: body['appearanceMode'] as string | undefined,
        highContrast: body['highContrast'] as boolean | undefined,
      })
      await tier2Del(CacheKeys.userPreferences(req.auth.userId))
      res.json({ data: toPreferencesDto(prefs) })
    }),
  )

  return router
}
