import { Pool } from 'pg'

export interface ListRow {
  id: string
  space_id: string
  name: string
  color: string | null
  position: number
  is_archived: boolean
  created_by: string
  deleted_at: Date | null
}

const DEFAULT_STATUSES = [
  { name: 'Backlog',      color: '#94a3b8', group: 'backlog',    position: 0,    isDefault: false },
  { name: 'Todo',         color: '#64748b', group: 'unstarted',  position: 1000, isDefault: true  },
  { name: 'In Progress',  color: '#3b82f6', group: 'started',    position: 2000, isDefault: false },
  { name: 'Done',         color: '#22c55e', group: 'completed',  position: 3000, isDefault: false },
  { name: 'Cancelled',    color: '#ef4444', group: 'cancelled',  position: 4000, isDefault: false },
]

export class ListsRepository {
  constructor(private readonly db: Pool) {}

  async createList(input: { spaceId: string; name: string; color?: string | null; createdBy: string; position: number }): Promise<ListRow> {
    const r = await this.db.query<ListRow>(
      `INSERT INTO lists (space_id, name, color, position, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.spaceId, input.name, input.color ?? null, input.position, input.createdBy],
    )
    return r.rows[0]!
  }

  async seedDefaultStatuses(listId: string): Promise<void> {
    for (const s of DEFAULT_STATUSES) {
      await this.db.query(
        `INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [listId, s.name, s.color, s.group, s.position, s.isDefault],
      )
    }
  }

  async getList(id: string): Promise<(ListRow & { workspace_id: string }) | null> {
    const r = await this.db.query<ListRow & { workspace_id: string }>(
      `SELECT l.*, s.workspace_id
       FROM lists l JOIN spaces s ON s.id = l.space_id
       WHERE l.id = $1 AND l.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getListsBySpace(spaceId: string): Promise<ListRow[]> {
    const r = await this.db.query<ListRow>(
      `SELECT * FROM lists WHERE space_id = $1 AND deleted_at IS NULL ORDER BY position ASC`,
      [spaceId],
    )
    return r.rows
  }

  async updateList(id: string, input: { name?: string; color?: string | null; isArchived?: boolean }): Promise<ListRow> {
    const r = await this.db.query<ListRow>(
      `UPDATE lists
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           is_archived = COALESCE($4, is_archived)
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, input.name ?? null, input.color ?? null, input.isArchived ?? null],
    )
    return r.rows[0]!
  }

  async softDeleteList(id: string): Promise<void> {
    await this.db.query(`UPDATE lists SET deleted_at = NOW() WHERE id = $1`, [id])
  }

  async getMaxPosition(spaceId: string): Promise<number> {
    const r = await this.db.query<{ max: number }>(
      `SELECT COALESCE(MAX(position), 0) AS max FROM lists WHERE space_id = $1 AND deleted_at IS NULL`,
      [spaceId],
    )
    return r.rows[0]!.max
  }

  async getSpaceWithWorkspace(spaceId: string): Promise<{ workspace_id: string; id: string } | null> {
    const r = await this.db.query<{ workspace_id: string; id: string }>(
      `SELECT id, workspace_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [spaceId],
    )
    return r.rows[0] ?? null
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<{ role: string } | null> {
    const r = await this.db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }
}
