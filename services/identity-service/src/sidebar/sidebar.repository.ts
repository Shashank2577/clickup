import { Pool } from 'pg'

export interface SidebarConfigRow {
  id: string
  user_id: string
  workspace_id: string
  config: unknown // JSONB
  updated_at: Date
}

export class SidebarRepository {
  constructor(private readonly db: Pool) {}

  async getConfig(userId: string, workspaceId: string): Promise<SidebarConfigRow | null> {
    const r = await this.db.query<SidebarConfigRow>(
      `SELECT * FROM user_sidebar_config WHERE user_id = $1 AND workspace_id = $2`,
      [userId, workspaceId],
    )
    return r.rows[0] ?? null
  }

  async upsertConfig(userId: string, workspaceId: string, config: unknown): Promise<SidebarConfigRow> {
    const r = await this.db.query<SidebarConfigRow>(
      `INSERT INTO user_sidebar_config (user_id, workspace_id, config)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, workspace_id)
       DO UPDATE SET config = $3, updated_at = NOW()
       RETURNING *`,
      [userId, workspaceId, JSON.stringify(config)],
    )
    return r.rows[0]!
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<{ role: string } | null> {
    const r = await this.db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }
}
