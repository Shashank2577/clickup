import { Pool } from 'pg'

export interface FolderRow {
  id: string
  space_id: string
  name: string
  color: string | null
  position: number
  is_private: boolean
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface FolderWithLists extends FolderRow {
  lists: {
    id: string
    name: string
    color: string | null
    position: number
    is_archived: boolean
    folder_id: string
  }[]
}

export class FoldersRepository {
  constructor(private readonly db: Pool) {}

  async createFolder(input: {
    spaceId: string
    name: string
    color?: string | null
    isPrivate?: boolean
    createdBy: string
    position: number
  }): Promise<FolderRow> {
    const r = await this.db.query<FolderRow>(
      `INSERT INTO folders (space_id, name, color, is_private, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.spaceId,
        input.name,
        input.color ?? null,
        input.isPrivate ?? false,
        input.position,
        input.createdBy,
      ],
    )
    return r.rows[0]!
  }

  async getFolder(id: string): Promise<FolderRow | null> {
    const r = await this.db.query<FolderRow>(
      `SELECT * FROM folders WHERE id = $1`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getFoldersWithListsBySpace(spaceId: string): Promise<FolderWithLists[]> {
    // Get all folders in space
    const folderResult = await this.db.query<FolderRow>(
      `SELECT * FROM folders WHERE space_id = $1 ORDER BY position ASC`,
      [spaceId],
    )
    const folders = folderResult.rows

    if (folders.length === 0) return []

    const folderIds = folders.map((f) => f.id)
    const placeholders = folderIds.map((_, i) => `$${i + 1}`).join(', ')

    // Get lists belonging to these folders
    const listResult = await this.db.query<{
      id: string
      name: string
      color: string | null
      position: number
      is_archived: boolean
      folder_id: string
    }>(
      `SELECT id, name, color, position, is_archived, folder_id
       FROM lists
       WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL
       ORDER BY position ASC`,
      folderIds,
    )

    // Group lists by folder_id
    const listsByFolder = new Map<string, typeof listResult.rows>()
    for (const list of listResult.rows) {
      const existing = listsByFolder.get(list.folder_id) ?? []
      existing.push(list)
      listsByFolder.set(list.folder_id, existing)
    }

    return folders.map((folder) => ({
      ...folder,
      lists: listsByFolder.get(folder.id) ?? [],
    }))
  }

  async updateFolder(
    id: string,
    input: { name?: string; color?: string | null },
  ): Promise<FolderRow> {
    const r = await this.db.query<FolderRow>(
      `UPDATE folders
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? null, input.color ?? null],
    )
    return r.rows[0]!
  }

  async deleteFolder(id: string): Promise<void> {
    // Lists inside become folderless (folder_id SET NULL by FK constraint),
    // so we just delete the folder row directly.
    await this.db.query(`DELETE FROM folders WHERE id = $1`, [id])
  }

  async getMaxPosition(spaceId: string): Promise<number> {
    const r = await this.db.query<{ max: number }>(
      `SELECT COALESCE(MAX(position), 0) AS max FROM folders WHERE space_id = $1`,
      [spaceId],
    )
    return r.rows[0]!.max
  }

  async getSpaceWithWorkspace(spaceId: string): Promise<{ id: string; workspace_id: string } | null> {
    const r = await this.db.query<{ id: string; workspace_id: string }>(
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

  /** Used by lists handler to create a list inside a folder */
  async getFolderWithSpace(folderId: string): Promise<{ id: string; space_id: string; workspace_id: string } | null> {
    const r = await this.db.query<{ id: string; space_id: string; workspace_id: string }>(
      `SELECT f.id, f.space_id, s.workspace_id
       FROM folders f
       JOIN spaces s ON s.id = f.space_id
       WHERE f.id = $1 AND s.deleted_at IS NULL`,
      [folderId],
    )
    return r.rows[0] ?? null
  }
}
