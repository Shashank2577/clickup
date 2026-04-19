import { Pool } from 'pg'

export interface SpaceRow {
  id: string
  workspace_id: string
  name: string
  color: string | null
  icon: string | null
  is_private: boolean
  position: number
  created_by: string
  deleted_at: Date | null
}

export class SpacesRepository {
  constructor(private readonly db: Pool) {}

  async createSpace(input: {
    workspaceId: string
    name: string
    color?: string
    icon?: string
    isPrivate?: boolean
    createdBy: string
    position: number
  }): Promise<SpaceRow> {
    const r = await this.db.query<SpaceRow>(
      `INSERT INTO spaces (workspace_id, name, color, icon, is_private, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.workspaceId, input.name, input.color ?? null, input.icon ?? null,
       input.isPrivate ?? false, input.position, input.createdBy],
    )
    return r.rows[0]!
  }

  async getSpace(id: string): Promise<SpaceRow | null> {
    const r = await this.db.query<SpaceRow>(
      `SELECT * FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getSpacesByWorkspace(workspaceId: string, userId: string): Promise<SpaceRow[]> {
    const r = await this.db.query<SpaceRow>(
      `SELECT * FROM spaces
       WHERE workspace_id = $1 AND deleted_at IS NULL
         AND (is_private = FALSE OR created_by = $2)
       ORDER BY position ASC`,
      [workspaceId, userId],
    )
    return r.rows
  }

  async updateSpace(id: string, input: { name?: string; color?: string; icon?: string }): Promise<SpaceRow> {
    const r = await this.db.query<SpaceRow>(
      `UPDATE spaces
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           icon = COALESCE($4, icon)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, input.name ?? null, input.color ?? null, input.icon ?? null],
    )
    return r.rows[0]!
  }

  async softDeleteSpace(id: string): Promise<void> {
    await this.db.query(
      `UPDATE spaces SET deleted_at = NOW() WHERE id = $1`,
      [id],
    )
  }

  async softDeleteListsBySpace(spaceId: string): Promise<void> {
    await this.db.query(
      `UPDATE lists SET deleted_at = NOW() WHERE space_id = $1 AND deleted_at IS NULL`,
      [spaceId],
    )
  }

  async getMaxPosition(workspaceId: string): Promise<number> {
    const r = await this.db.query<{ max: number }>(
      `SELECT COALESCE(MAX(position), 0) AS max FROM spaces WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [workspaceId],
    )
    return r.rows[0]!.max
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<{ role: string } | null> {
    const r = await this.db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }
}
