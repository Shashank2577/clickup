import { Pool, PoolClient } from 'pg'

export interface TrashItemRow {
  id: string
  entity_type: 'space' | 'list'
  name: string
  workspace_id: string
  deleted_at: Date
}

export class TrashRepository {
  constructor(private readonly db: Pool) {}

  async getDeletedItems(workspaceId: string, entityType?: string): Promise<TrashItemRow[]> {
    if (entityType === 'space') {
      const r = await this.db.query<TrashItemRow>(
        `SELECT id, 'space'::text AS entity_type, name, workspace_id, deleted_at
         FROM spaces
         WHERE workspace_id = $1 AND deleted_at IS NOT NULL
         ORDER BY deleted_at DESC`,
        [workspaceId],
      )
      return r.rows
    }

    if (entityType === 'list') {
      const r = await this.db.query<TrashItemRow>(
        `SELECT l.id, 'list'::text AS entity_type, l.name, s.workspace_id, l.deleted_at
         FROM lists l
         JOIN spaces s ON s.id = l.space_id
         WHERE s.workspace_id = $1 AND l.deleted_at IS NOT NULL
         ORDER BY l.deleted_at DESC`,
        [workspaceId],
      )
      return r.rows
    }

    // All types
    const r = await this.db.query<TrashItemRow>(
      `SELECT id, 'space'::text AS entity_type, name, workspace_id, deleted_at
       FROM spaces
       WHERE workspace_id = $1 AND deleted_at IS NOT NULL
       UNION ALL
       SELECT l.id, 'list'::text AS entity_type, l.name, s.workspace_id, l.deleted_at
       FROM lists l
       JOIN spaces s ON s.id = l.space_id
       WHERE s.workspace_id = $1 AND l.deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [workspaceId],
    )
    return r.rows
  }

  async getDeletedSpace(id: string): Promise<{ id: string; workspace_id: string; deleted_at: Date | null } | null> {
    const r = await this.db.query<{ id: string; workspace_id: string; deleted_at: Date | null }>(
      `SELECT id, workspace_id, deleted_at FROM spaces WHERE id = $1`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getDeletedList(id: string): Promise<{ id: string; space_id: string; workspace_id: string; deleted_at: Date | null } | null> {
    const r = await this.db.query<{ id: string; space_id: string; workspace_id: string; deleted_at: Date | null }>(
      `SELECT l.id, l.space_id, s.workspace_id, l.deleted_at
       FROM lists l JOIN spaces s ON s.id = l.space_id
       WHERE l.id = $1`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async restoreSpace(id: string): Promise<void> {
    await this.db.query(
      `UPDATE spaces SET deleted_at = NULL WHERE id = $1`,
      [id],
    )
  }

  async restoreList(id: string): Promise<void> {
    await this.db.query(
      `UPDATE lists SET deleted_at = NULL WHERE id = $1`,
      [id],
    )
  }

  async restoreListsBySpace(spaceId: string, client?: PoolClient): Promise<void> {
    const q = client ?? this.db
    await q.query(
      `UPDATE lists SET deleted_at = NULL WHERE space_id = $1 AND deleted_at IS NOT NULL`,
      [spaceId],
    )
  }

  async permanentlyDeleteSpace(id: string): Promise<void> {
    // CASCADE will handle lists, tasks, etc.
    await this.db.query(`DELETE FROM spaces WHERE id = $1`, [id])
  }

  async permanentlyDeleteList(id: string): Promise<void> {
    // CASCADE will handle tasks, statuses, etc.
    await this.db.query(`DELETE FROM lists WHERE id = $1`, [id])
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<{ role: string } | null> {
    const r = await this.db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }
}
