import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError, tier2Del, tier2Get, tier2Set, CacheKeys } from '@clickup/sdk'
import { ErrorCode, UpdatePresenceSchema } from '@clickup/contracts'
import { PresenceRepository } from './presence.repository.js'

function toPresenceDto(row: {
  user_id: string
  status: string
  last_seen_at: Date
}) {
  return {
    userId: row.user_id,
    status: row.status,
    lastSeenAt: row.last_seen_at.toISOString(),
  }
}

export function presenceRoutes(db: Pool): Router {
  const router = Router()
  const repository = new PresenceRepository(db)

  // PUT /users/me/presence — update own presence
  router.put(
    '/me/presence',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(UpdatePresenceSchema, req.body)
      const presence = await repository.upsertPresence(req.auth.userId, input.status)
      await tier2Del(CacheKeys.userPresence(req.auth.userId))
      res.json({ data: toPresenceDto(presence) })
    }),
  )

  // GET /users/presence?userIds=id1,id2,... — get presence for multiple users
  router.get(
    '/presence',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rawIds = req.query['userIds'] as string
      if (!rawIds) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'userIds query param is required')

      const userIds = rawIds.split(',').map((id) => id.trim()).filter(Boolean)
      if (userIds.length === 0) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'At least one userId is required')
      if (userIds.length > 100) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Max 100 userIds per request')

      const presences = await repository.getPresenceByUserIds(userIds)
      const presenceMap = new Map(presences.map((p) => [p.user_id, p]))

      // Return presence for all requested users, defaulting to offline for unknown
      const result = userIds.map((uid) => {
        const p = presenceMap.get(uid)
        if (p) return toPresenceDto(p)
        return { userId: uid, status: 'offline', lastSeenAt: null }
      })

      res.json({ data: result })
    }),
  )

  return router
}
