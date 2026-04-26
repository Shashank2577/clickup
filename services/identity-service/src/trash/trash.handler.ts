import { Router } from 'express'
import type { Pool, PoolClient } from 'pg'
import { requireAuth, asyncHandler, AppError, tier2Del, CacheKeys } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TrashRepository } from './trash.repository.js'

function toTrashItemDto(row: {
  id: string
  entity_type: string
  name: string
  workspace_id: string
  deleted_at: Date
}) {
  return {
    id: row.id,
    entityType: row.entity_type,
    name: row.name,
    workspaceId: row.workspace_id,
    deletedAt: row.deleted_at.toISOString(),
  }
}

export function trashRoutes(db: Pool): Router {
  const router = Router()
  const repository = new TrashRepository(db)

  // GET /trash?workspaceId=...&entityType=...
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param is required')
      const member = await repository.getWorkspaceMember(workspaceId, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const entityType = req.query['entityType'] as string | undefined
      const items = await repository.getDeletedItems(workspaceId, entityType)
      res.json({ data: items.map(toTrashItemDto) })
    }),
  )

  // POST /trash/:id/restore?entityType=... — restore a soft-deleted item
  router.post(
    '/:id/restore',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const entityType = req.query['entityType'] as string ?? req.body?.entityType

      if (entityType === 'space') {
        const space = await repository.getDeletedSpace(id)
        if (!space || space.deleted_at === null) throw new AppError(ErrorCode.TRASH_ITEM_NOT_FOUND)
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId)
        if (!member || !['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

        // Restore space and its lists in a transaction
        const client: PoolClient = await db.connect()
        try {
          await client.query('BEGIN')
          await repository.restoreSpace(id)
          await repository.restoreListsBySpace(id, client)
          await client.query('COMMIT')
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
        await tier2Del(CacheKeys.spaceHierarchy(space.workspace_id))
        res.json({ data: { id, entityType: 'space', restored: true } })
        return
      }

      if (entityType === 'list') {
        const list = await repository.getDeletedList(id)
        if (!list || list.deleted_at === null) throw new AppError(ErrorCode.TRASH_ITEM_NOT_FOUND)
        const member = await repository.getWorkspaceMember(list.workspace_id, req.auth.userId)
        if (!member || !['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

        await repository.restoreList(id)
        await tier2Del(CacheKeys.spaceHierarchy(list.workspace_id))
        res.json({ data: { id, entityType: 'list', restored: true } })
        return
      }

      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'entityType must be "space" or "list"')
    }),
  )

  // DELETE /trash/:id?entityType=... — permanently delete
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const entityType = req.query['entityType'] as string

      if (entityType === 'space') {
        const space = await repository.getDeletedSpace(id)
        if (!space || space.deleted_at === null) throw new AppError(ErrorCode.TRASH_ITEM_NOT_FOUND)
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId)
        if (!member || member.role !== 'owner') throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

        await repository.permanentlyDeleteSpace(id)
        await tier2Del(CacheKeys.spaceHierarchy(space.workspace_id))
        res.status(204).end()
        return
      }

      if (entityType === 'list') {
        const list = await repository.getDeletedList(id)
        if (!list || list.deleted_at === null) throw new AppError(ErrorCode.TRASH_ITEM_NOT_FOUND)
        const member = await repository.getWorkspaceMember(list.workspace_id, req.auth.userId)
        if (!member || member.role !== 'owner') throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

        await repository.permanentlyDeleteList(id)
        await tier2Del(CacheKeys.spaceHierarchy(list.workspace_id))
        res.status(204).end()
        return
      }

      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'entityType must be "space" or "list"')
    }),
  )

  return router
}
