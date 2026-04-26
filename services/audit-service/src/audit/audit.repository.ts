import { Pool } from 'pg'

// ============================================================
// Audit Log Repository
// Uses the existing audit_logs table from migration 008
// with additional columns (changes, user_agent) from migration 013
// ============================================================

export interface AuditLog {
  id: string
  workspaceId: string
  actorId: string | null
  resourceType: string
  resourceId: string | null
  action: string
  metadata: Record<string, unknown>
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

function mapAuditRow(r: Record<string, unknown>): AuditLog {
  return {
    id: r['id'] as string,
    workspaceId: r['workspace_id'] as string,
    actorId: (r['actor_id'] as string) ?? null,
    resourceType: r['resource_type'] as string,
    resourceId: (r['resource_id'] as string) ?? null,
    action: r['action'] as string,
    metadata: (r['metadata'] as Record<string, unknown>) ?? {},
    changes: (r['changes'] as Record<string, unknown>) ?? null,
    ipAddress: (r['ip_address'] as string) ?? null,
    userAgent: (r['user_agent'] as string) ?? null,
    createdAt: String(r['created_at']),
  }
}

export function createAuditRepository(db: Pool) {
  return {
    async createAuditLog(input: {
      workspaceId: string
      actorId: string
      action: string
      entityType: string
      entityId?: string
      changes?: Record<string, unknown>
      ipAddress?: string
      userAgent?: string
      metadata?: Record<string, unknown>
    }): Promise<AuditLog> {
      const { rows } = await db.query(
        `INSERT INTO audit_logs (workspace_id, actor_id, resource_type, resource_id, action, metadata, changes, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9)
         RETURNING *`,
        [
          input.workspaceId,
          input.actorId,
          input.entityType,
          input.entityId ?? null,
          input.action,
          JSON.stringify(input.metadata ?? {}),
          input.changes ? JSON.stringify(input.changes) : null,
          input.ipAddress ?? null,
          input.userAgent ?? null,
        ],
      )
      return mapAuditRow(rows[0])
    },

    async listAuditLogs(filters: {
      workspaceId: string
      actorId?: string
      action?: string
      entityType?: string
      entityId?: string
      fromDate?: string
      toDate?: string
      limit: number
      offset: number
    }): Promise<{ logs: AuditLog[]; total: number }> {
      const conditions: string[] = ['workspace_id = $1']
      const params: unknown[] = [filters.workspaceId]

      if (filters.actorId) {
        params.push(filters.actorId)
        conditions.push(`actor_id = $${params.length}`)
      }
      if (filters.action) {
        params.push(filters.action)
        conditions.push(`action = $${params.length}`)
      }
      if (filters.entityType) {
        params.push(filters.entityType)
        conditions.push(`resource_type = $${params.length}`)
      }
      if (filters.entityId) {
        params.push(filters.entityId)
        conditions.push(`resource_id = $${params.length}`)
      }
      if (filters.fromDate) {
        params.push(filters.fromDate)
        conditions.push(`created_at >= $${params.length}`)
      }
      if (filters.toDate) {
        params.push(filters.toDate)
        conditions.push(`created_at <= $${params.length}`)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      // Count
      const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
        params,
      )
      const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

      // Data
      params.push(filters.limit)
      params.push(filters.offset)
      const { rows } = await db.query(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      )

      return { logs: rows.map(mapAuditRow), total }
    },

    async getAuditLog(id: string): Promise<AuditLog | null> {
      const { rows } = await db.query(
        `SELECT * FROM audit_logs WHERE id = $1`,
        [id],
      )
      return rows[0] ? mapAuditRow(rows[0]) : null
    },

    async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
      const result = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
        [workspaceId, userId],
      )
      return (result.rowCount ?? 0) > 0
    },
  }
}

export type AuditRepository = ReturnType<typeof createAuditRepository>
