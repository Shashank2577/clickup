import { Request, Response } from 'express'
import { asyncHandler, validate } from '@clickup/sdk'
import { AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import {
  CreateViewSchema,
  UpdateViewSchema,
  UpdateViewUserStateSchema,
} from '@clickup/contracts'
import { Pool } from 'pg'
import { ViewsRepository } from './views.repository.js'
import { executeViewQuery, executeWorkloadQuery } from './query-engine.js'

// ============================================================
// Views Handlers
// All handlers require auth — req.auth.userId set by requireAuth
// ============================================================

export function createViewHandlers(repo: ViewsRepository, db?: Pool) {
  const createView = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const input = validate(CreateViewSchema, req.body) as any

    // workspaceId must be in body
    const workspaceId = req.body.workspaceId as string | undefined
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }

    // Verify user is workspace member
    const isMember = await repo.isWorkspaceMember(workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const view = await repo.createView({
      listId: input.listId ?? null,
      workspaceId,
      name: input.name,
      type: input.type,
      config: input.config ?? {},
      createdBy: userId,
      isPrivate: input.isPrivate ?? false,
    })

    res.status(201).json({ data: view })
  })

  const listViewsByList = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { listId } = req.params as { listId: string }

    const views = await repo.listViewsByList(listId, userId)
    res.status(200).json({ data: views })
  })

  const listViewsByWorkspace = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { workspaceId } = req.params as { workspaceId: string }

    const isMember = await repo.isWorkspaceMember(workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const views = await repo.listViewsByWorkspace(workspaceId, userId)
    res.status(200).json({ data: views })
  })

  const getView = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const view = await repo.getView(viewId)
    if (!view) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    // Private view: only the owner can see it
    if (view.isPrivate && view.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    // Must be workspace member
    const isMember = await repo.isWorkspaceMember(view.workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    res.status(200).json({ data: view })
  })

  const updateView = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const existing = await repo.getView(viewId)
    if (!existing) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    // Only the owner can update
    if (existing.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    const input = validate(UpdateViewSchema, req.body) as any

    const updated = await repo.updateView(viewId, {
      name: input.name,
      config: input.config,
      isPrivate: input.isPrivate,
    })

    res.status(200).json({ data: updated })
  })

  const deleteView = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const existing = await repo.getView(viewId)
    if (!existing) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    // Only the owner can delete
    if (existing.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    await repo.deleteView(viewId)
    res.status(204).send()
  })

  const getUserState = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const view = await repo.getView(viewId)
    if (!view) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    if (view.isPrivate && view.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    const state = await repo.getUserState(viewId, userId)

    // Return empty state if none exists yet
    res.status(200).json({
      data: state ?? {
        viewId,
        userId,
        collapsedGroups: [],
        hiddenColumns: [],
      },
    })
  })

  const upsertUserState = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const view = await repo.getView(viewId)
    if (!view) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    if (view.isPrivate && view.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    const input = validate(UpdateViewUserStateSchema, req.body) as any

    const state = await repo.upsertUserState(viewId, userId, {
      collapsedGroups: input.collapsedGroups,
      hiddenColumns: input.hiddenColumns,
    })

    res.status(200).json({ data: state })
  })

  // ============================================================
  // GET /:viewId/tasks — execute the view query and return tasks
  // Query params: page, pageSize, groupBy, from (ISO), to (ISO)
  // ============================================================

  const getViewTasks = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const view = await repo.getView(viewId)
    if (!view) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    if (view.isPrivate && view.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    const isMember = await repo.isWorkspaceMember(view.workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    if (!db) {
      throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'DB pool not available')
    }

    const page = parseInt(String(req.query['page'] ?? '1'), 10)
    const pageSize = parseInt(String(req.query['pageSize'] ?? '50'), 10)
    const groupByOverride = req.query['groupBy'] as string | undefined
    const from = req.query['from'] as string | undefined
    const to = req.query['to'] as string | undefined

    const result = await executeViewQuery(view, db, {
      page,
      pageSize,
      groupByOverride,
      from,
      to,
    })

    res.status(200).json({ data: result })
  })

  // ============================================================
  // GET /:viewId/workload — workload view grouped by assignee
  // ============================================================

  const getViewWorkload = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { viewId } = req.params as { viewId: string }

    const view = await repo.getView(viewId)
    if (!view) {
      throw new AppError(ErrorCode.VIEW_NOT_FOUND)
    }

    if (view.isPrivate && view.createdBy !== userId) {
      throw new AppError(ErrorCode.VIEW_ACCESS_DENIED)
    }

    const isMember = await repo.isWorkspaceMember(view.workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    if (!db) {
      throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'DB pool not available')
    }

    const result = await executeWorkloadQuery(view, db, {})

    res.status(200).json({ data: result })
  })

  return {
    createView,
    listViewsByList,
    listViewsByWorkspace,
    getView,
    updateView,
    deleteView,
    getUserState,
    upsertUserState,
    getViewTasks,
    getViewWorkload,
  }
}
