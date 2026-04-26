import { Request, Response } from 'express'
import { asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateAuditLogSchema } from '@clickup/contracts'
import { AuditRepository } from './audit.repository.js'

// ============================================================
// Audit Log Handlers
// ============================================================

export function createAuditHandlers(repo: AuditRepository) {

  // POST /api/v1/audit-logs — record audit entry
  const createAuditLog = asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query['workspaceId'] as string
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query param required')
    }

    const input = validate(CreateAuditLogSchema, req.body) as {
      actorId: string
      action: string
      entityType: string
      entityId?: string
      changes?: Record<string, unknown>
      ipAddress?: string
    }

    const userAgent = req.headers['user-agent'] ?? undefined

    const log = await repo.createAuditLog({
      workspaceId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes,
      ipAddress: input.ipAddress ?? (req.ip || undefined),
      userAgent: userAgent as string | undefined,
    })

    res.status(201).json({ data: log })
  })

  // GET /api/v1/audit-logs — list with filters
  const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const workspaceId = req.query['workspaceId'] as string
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query param required')
    }

    const isMember = await repo.isWorkspaceMember(workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const actorId = req.query['actorId'] as string | undefined
    const action = req.query['action'] as string | undefined
    const entityType = req.query['entityType'] as string | undefined
    const entityId = req.query['entityId'] as string | undefined
    const fromDate = req.query['fromDate'] as string | undefined
    const toDate = req.query['toDate'] as string | undefined
    const limit = Math.min(Number(req.query['limit'] ?? 50), 100)
    const offset = Math.max(Number(req.query['offset'] ?? 0), 0)

    const { logs, total } = await repo.listAuditLogs({
      workspaceId,
      actorId,
      action,
      entityType,
      entityId,
      fromDate,
      toDate,
      limit,
      offset,
    })

    res.status(200).json({ data: logs, total, limit, offset })
  })

  // GET /api/v1/audit-logs/:id — get single audit log
  const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string }

    const log = await repo.getAuditLog(id)
    if (!log) {
      throw new AppError(ErrorCode.AUDIT_LOG_NOT_FOUND)
    }

    // Verify caller is a member of the workspace this audit log belongs to
    const userId = (req as any).auth!.userId as string
    const isMember = await repo.isWorkspaceMember(log.workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    res.status(200).json({ data: log })
  })

  return {
    createAuditLog,
    listAuditLogs,
    getAuditLog,
  }
}
