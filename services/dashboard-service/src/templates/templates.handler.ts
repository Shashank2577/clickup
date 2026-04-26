import { Request, Response } from 'express'
import { asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { db } from '../dashboards/dashboards.repository.js'
import { createTemplatesRepository } from './templates.repository.js'

const templatesRepo = createTemplatesRepository(db)

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

// ============================================================
// Handlers
// ============================================================

export const listTemplatesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const templates = await templatesRepo.listTemplates()
    res.status(200).json({ data: templates })
  },
)

export const createFromTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const templateId = req.params['templateId']!
    const workspaceId = req.params['workspaceId']!
    const userId = (req as any).auth!.userId
    const traceId = (req.headers['x-trace-id'] as string) || ''

    await verifyWorkspaceMembership(workspaceId, userId, traceId)

    const nameOverride = req.body?.name as string | undefined

    const { dashboard, widgetCount } = await templatesRepo.createDashboardFromTemplate(
      templateId,
      workspaceId,
      userId,
      nameOverride,
    )

    if (!dashboard) {
      throw new AppError(ErrorCode.DASHBOARD_TEMPLATE_NOT_FOUND)
    }

    res.status(201).json({ data: { dashboard, widgetCount } })
  },
)
