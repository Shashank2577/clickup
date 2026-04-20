import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateListSchema, UpdateListSchema } from '@clickup/contracts'
import { ListsRepository } from './lists.repository.js'

function toListDto(
  row: {
    id: string
    space_id: string
    name: string
    color: string | null
    position: number
    is_archived: boolean
    created_by: string
    workspace_id?: string
  },
) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    color: row.color,
    position: row.position,
    isArchived: row.is_archived,
    createdBy: row.created_by,
    workspaceId: row.workspace_id ?? null,
  }
}

// Routes mounted at /spaces/:spaceId/lists
export function spaceListsRoutes(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new ListsRepository(db)

  // POST /spaces/:spaceId/lists
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { spaceId } = req.params
      if (!spaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required')
      const space = await repository.getSpaceWithWorkspace(spaceId)
      if (!space) throw new AppError(ErrorCode.SPACE_NOT_FOUND)
      const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const input = validate(CreateListSchema, req.body)
      const maxPos = await repository.getMaxPosition(spaceId)
      const list = await repository.createList({
        spaceId,
        name: input.name,
        color: input.color ?? undefined,
        createdBy: req.auth.userId,
        position: maxPos + 1000,
      })
      await repository.seedDefaultStatuses(list.id)
      res.status(201).json({ data: toListDto(list) })
    }),
  )

  // GET /spaces/:spaceId/lists
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { spaceId } = req.params
      if (!spaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required')
      const space = await repository.getSpaceWithWorkspace(spaceId)
      if (!space) throw new AppError(ErrorCode.SPACE_NOT_FOUND)
      const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const lists = await repository.getListsBySpace(spaceId)
      res.json({ data: lists.map(toListDto) })
    }),
  )

  return router
}

// Routes mounted at /lists
export function listsRoutes(db: Pool): Router {
  const router = Router()
  const repository = new ListsRepository(db)

  // GET /lists/:listId — critical, called by task-service
  router.get(
    '/:listId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { listId } = req.params
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId is required')
      const list = await repository.getList(listId)
      if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
      const member = await repository.getWorkspaceMember(list.workspace_id, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      res.json({ data: toListDto(list) })
    }),
  )

  // PATCH /lists/:listId
  router.patch(
    '/:listId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { listId } = req.params
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId is required')
      const list = await repository.getList(listId)
      if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
      const member = await repository.getWorkspaceMember(list.workspace_id, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const input = validate(UpdateListSchema, req.body)
      const updated = await repository.updateList(listId, input)
      res.json({ data: toListDto(updated) })
    }),
  )

  // DELETE /lists/:listId
  router.delete(
    '/:listId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { listId } = req.params
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId is required')
      const list = await repository.getList(listId)
      if (!list) throw new AppError(ErrorCode.LIST_NOT_FOUND)
      const member = await repository.getWorkspaceMember(list.workspace_id, req.auth.userId)
      if (!member || !['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      await repository.softDeleteList(listId)
      res.status(204).end()
    }),
  )

  return router
}
