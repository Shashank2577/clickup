import { z } from 'zod'

const uuid = z.string().uuid()

// ============================================================
// Audit log schemas
// ============================================================

export const CreateAuditLogSchema = z.object({
  actorId: uuid,
  action: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: uuid.optional(),
  changes: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
})

export const ListAuditLogsQuerySchema = z.object({
  workspaceId: uuid,
  actorId: uuid.optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: uuid.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
})

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>
