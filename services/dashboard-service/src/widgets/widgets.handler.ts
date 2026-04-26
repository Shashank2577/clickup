import { Request, Response } from 'express'
import { asyncHandler, validate, AppError, createServiceClient } from '@clickup/sdk'
import {
  CreateWidgetSchema,
  UpdateWidgetSchema,
  ErrorCode,
} from '@clickup/contracts'
import { db, dashboardsRepository } from '../dashboards/dashboards.repository.js'
import { widgetsRepository } from './widgets.repository.js'

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

async function resolveDashboard(dashboardId: string) {
  const dashboard = await dashboardsRepository.getDashboard(dashboardId)
  if (!dashboard) throw new AppError(ErrorCode.DASHBOARD_NOT_FOUND)
  return dashboard
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

export const addWidgetHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboardId = req.params['dashboardId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const dashboard = await resolveDashboard(dashboardId)
    await verifyWorkspaceMembership(dashboard.workspace_id, userId, traceId)
    assertDashboardAccess(dashboard, userId)

    const input = validate(CreateWidgetSchema, req.body)

    const widget = await widgetsRepository.createWidget(
      db,
      dashboardId,
      input.type,
      input.title,
      (input.config ?? {}) as Record<string, unknown>,
      input.positionX ?? 0,
      input.positionY ?? 0,
      input.width ?? 4,
      input.height ?? 3,
    )

    res.status(201).json({ data: widget })
  },
)

export const updateWidgetHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const widgetId = req.params['widgetId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const widget = await widgetsRepository.getWidget(db, widgetId)
    if (!widget) throw new AppError(ErrorCode.WIDGET_NOT_FOUND)

    const dashboard = await resolveDashboard(widget.dashboardId)
    await verifyWorkspaceMembership(dashboard.workspace_id, userId, traceId)
    assertDashboardAccess(dashboard, userId)

    const input = validate(UpdateWidgetSchema, req.body)

    const updated = await widgetsRepository.updateWidget(
      db,
      widgetId,
      input.title,
      input.config as Record<string, unknown> | undefined,
      input.positionX,
      input.positionY,
      input.width,
      input.height,
    )

    res.status(200).json({ data: updated })
  },
)

export const deleteWidgetHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const widgetId = req.params['widgetId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const widget = await widgetsRepository.getWidget(db, widgetId)
    if (!widget) throw new AppError(ErrorCode.WIDGET_NOT_FOUND)

    const dashboard = await resolveDashboard(widget.dashboardId)
    await verifyWorkspaceMembership(dashboard.workspace_id, userId, traceId)
    assertDashboardAccess(dashboard, userId)

    await widgetsRepository.deleteWidget(db, widgetId)

    res.status(204).send()
  },
)

export const getWidgetDataHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboardId = req.params['dashboardId']!
    const widgetId = req.params['widgetId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    const dashboard = await resolveDashboard(dashboardId)
    await verifyWorkspaceMembership(dashboard.workspace_id, userId, traceId)
    assertDashboardAccess(dashboard, userId)

    const widget = await widgetsRepository.getWidget(db, widgetId)
    if (!widget) throw new AppError(ErrorCode.WIDGET_NOT_FOUND)

    // Ensure widget belongs to the specified dashboard
    if (widget.dashboardId !== dashboardId) {
      throw new AppError(ErrorCode.WIDGET_NOT_FOUND)
    }

    const data = await widgetsRepository.computeWidgetData(
      db,
      widget.type,
      widget.config as Record<string, unknown>,
      dashboard.workspace_id,
    )

    res.status(200).json({ data })
  },
)
