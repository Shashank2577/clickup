import { Pool } from 'pg'

export interface AuditLogRow {
  id: string
  workspace_id: string
  actor_id: string | null
  resource_type: string
  resource_id: string | null
  action: string
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: Date
}

export interface AuditLogFilters {
  actorId?: string
  resourceType?: string
  from?: string
  to?: string
}

export interface PaginatedAuditLog {
  data: AuditLogRow[]
  total: number
  page: number
  pageSize: number
}

export class AuditRepository {
  constructor(private readonly db: Pool) {}

  async getAuditLog(
    workspaceId: string,
    filters: AuditLogFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedAuditLog> {
    const conditions: string[] = ['workspace_id = $1']
    const params: unknown[] = [workspaceId]
    let paramIdx = 2

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIdx++}`)
      params.push(filters.actorId)
    }
    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIdx++}`)
      params.push(filters.resourceType)
    }
    if (filters.from) {
      conditions.push(`created_at >= $${paramIdx++}`)
      params.push(filters.from)
    }
    if (filters.to) {
      conditions.push(`created_at <= $${paramIdx++}`)
      params.push(filters.to)
    }

    const where = conditions.join(' AND ')
    const offset = (page - 1) * pageSize

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_logs WHERE ${where}`,
      params,
    )
    const total = parseInt(countResult.rows[0]!.count, 10)

    const dataResult = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pageSize, offset],
    )

    return { data: dataResult.rows, total, page, pageSize }
  }

  async logEvent(entry: {
    workspaceId: string
    actorId: string | null
    resourceType: string
    resourceId?: string | null
    action: string
    metadata?: Record<string, unknown>
    ipAddress?: string | null
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (workspace_id, actor_id, resource_type, resource_id, action, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.workspaceId,
        entry.actorId ?? null,
        entry.resourceType,
        entry.resourceId ?? null,
        entry.action,
        JSON.stringify(entry.metadata ?? {}),
        entry.ipAddress ?? null,
      ],
    )
  }
}
