import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError, tier2Del, tier2Get, tier2Set, CacheKeys } from '@clickup/sdk'
import { ErrorCode, SaveSidebarConfigSchema } from '@clickup/contracts'
import { SidebarRepository } from './sidebar.repository.js'

function toSidebarDto(row: {
  id: string
  user_id: string
  workspace_id: string
  config: unknown
  updated_at: Date
}) {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    items: row.config,
    updatedAt: row.updated_at.toISOString(),
  }
}

export function sidebarRoutes(db: Pool): Router {
  const router = Router()
  const repository = new SidebarRepository(db)

  // GET /sidebar?workspaceId=... — get user's sidebar config
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param is required')
      const member = await repository.getWorkspaceMember(workspaceId, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const cacheKey = CacheKeys.sidebarConfig(req.auth.userId, workspaceId)
      const cached = await tier2Get<ReturnType<typeof toSidebarDto>>(cacheKey)
      if (cached) {
        res.json({ data: cached })
        return
      }

      const config = await repository.getConfig(req.auth.userId, workspaceId)
      if (!config) {
        // Return empty default
        res.json({ data: { userId: req.auth.userId, workspaceId, items: [], updatedAt: null } })
        return
      }

      const dto = toSidebarDto(config)
      await tier2Set(cacheKey, dto)
      res.json({ data: dto })
    }),
  )

  // PUT /sidebar — save sidebar config
  router.put(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(SaveSidebarConfigSchema, req.body)
      const member = await repository.getWorkspaceMember(input.workspaceId, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const config = await repository.upsertConfig(req.auth.userId, input.workspaceId, input.items)
      const cacheKey = CacheKeys.sidebarConfig(req.auth.userId, input.workspaceId)
      await tier2Del(cacheKey)
      res.json({ data: toSidebarDto(config) })
    }),
  )

  return router
}
