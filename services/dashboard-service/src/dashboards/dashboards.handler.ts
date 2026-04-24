import { Request, Response } from 'express'
import { asyncHandler, validate, AppError, createServiceClient } from '@clickup/sdk'
import {
  CreateDashboardSchema,
  UpdateDashboardSchema,
  ErrorCode,
} from '@clickup/contracts'
import { dashboardsRepository } from './dashboards.repository.js'

// ============================================================
// Helpers
// ============================================================

async function verifyWorkspaceMembership(
  workspaceId: string,
  userId: string,
  traceId: string,
): Promise<void> {
  const identityClient = createServiceClient(
    process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  )
  try {
    await identityClient.get(`/internal/workspaces/${workspaceId}/members/${userId}`, {
      headers: { 'x-trace-id': traceId },
    })
  } catch {
    throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
  }
}

function assertDashboardAccess(
  dashboard: { is_private: boolean; owner_id: string },
  userId: string,
): void {
  if (dashboard.is_private && dashboard.owner_id !== userId) {
    throw new AppError(ErrorCode.DASHBOARD_ACCESS_DENIED)
  }
}

// ============================================================
// Handlers
// ============================================================

export const createDashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = req.params['workspaceId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    await verifyWorkspaceMembership(workspaceId, userId, traceId)

    const input = validate(CreateDashboardSchema, req.body)

    const dashboard = await dashboardsRepository.createDashboard(
      workspaceId,
      input.name,
      input.isPrivate ?? false,
      userId,
    )

    res.status(201).json({ data: dashboard })
  },
)

export const listDashboardsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = req.params['workspaceId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    await verifyWorkspaceMembership(workspaceId, userId, traceId)

    const dashboards = await dashboardsRepository.getDashboardsForWorkspace(
      workspaceId,
      userId,
    )

    res.status(200).json({ data: dashboards })
  },
)

export const getDashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboardId = req.params['dashboardId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const dashboard = await dashboardsRepository.getDashboard(dashboardId)
    if (!dashboard) throw new AppError(ErrorCode.DASHBOARD_NOT_FOUND)

    await verifyWorkspaceMembership(dashboard.workspace_id, userId, traceId)
    assertDashboardAccess(dashboard, userId)

    res.status(200).json({ data: dashboard })
  },
)

export const updateDashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboardId = req.params['dashboardId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const existing = await dashboardsRepository.getDashboard(dashboardId)
    if (!existing) throw new AppError(ErrorCode.DASHBOARD_NOT_FOUND)

    await verifyWorkspaceMembership(existing.workspace_id, userId, traceId)
    assertDashboardAccess(existing, userId)

    const input = validate(UpdateDashboardSchema, req.body)

    const updated = await dashboardsRepository.updateDashboard(
      dashboardId,
      input.name,
      input.isPrivate,
    )

    res.status(200).json({ data: updated })
  },
)

export const deleteDashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboardId = req.params['dashboardId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const existing = await dashboardsRepository.getDashboard(dashboardId)
    if (!existing) throw new AppError(ErrorCode.DASHBOARD_NOT_FOUND)

    await verifyWorkspaceMembership(existing.workspace_id, userId, traceId)
    assertDashboardAccess(existing, userId)

    await dashboardsRepository.deleteDashboard(dashboardId)

    res.status(204).send()
  },
)
