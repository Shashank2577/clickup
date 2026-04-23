export class FoldersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createFolder(input) {
        const r = await this.db.query(`INSERT INTO folders (space_id, name, color, is_private, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            input.spaceId,
            input.name,
            input.color ?? null,
            input.isPrivate ?? false,
            input.position,
            input.createdBy,
        ]);
        return r.rows[0];
    }
    async getFolder(id) {
        const r = await this.db.query(`SELECT * FROM folders WHERE id = $1`, [id]);
        return r.rows[0] ?? null;
    }
    async getFoldersWithListsBySpace(spaceId) {
        // Get all folders in space
        const folderResult = await this.db.query(`SELECT * FROM folders WHERE space_id = $1 ORDER BY position ASC`, [spaceId]);
        const folders = folderResult.rows;
        if (folders.length === 0)
            return [];
        const folderIds = folders.map((f) => f.id);
        const placeholders = folderIds.map((_, i) => `$${i + 1}`).join(', ');
        // Get lists belonging to these folders
        const listResult = await this.db.query(`SELECT id, name, color, position, is_archived, folder_id
       FROM lists
       WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL
       ORDER BY position ASC`, folderIds);
        // Group lists by folder_id
        const listsByFolder = new Map();
        for (const list of listResult.rows) {
            const existing = listsByFolder.get(list.folder_id) ?? [];
            existing.push(list);
            listsByFolder.set(list.folder_id, existing);
        }
        return folders.map((folder) => ({
            ...folder,
            lists: listsByFolder.get(folder.id) ?? [],
        }));
    }
    async updateFolder(id, input) {
        const r = await this.db.query(`UPDATE folders
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`, [id, input.name ?? null, input.color ?? null]);
        return r.rows[0];
    }
    async deleteFolder(id) {
        // Lists inside become folderless (folder_id SET NULL by FK constraint),
        // so we just delete the folder row directly.
        await this.db.query(`DELETE FROM folders WHERE id = $1`, [id]);
    }
    async getMaxPosition(spaceId) {
        const r = await this.db.query(`SELECT COALESCE(MAX(position), 0) AS max FROM folders WHERE space_id = $1`, [spaceId]);
        return r.rows[0].max;
    }
    async getSpaceWithWorkspace(spaceId) {
        const r = await this.db.query(`SELECT id, workspace_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`, [spaceId]);
        return r.rows[0] ?? null;
    }
    async getWorkspaceMember(workspaceId, userId) {
        const r = await this.db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
        return r.rows[0] ?? null;
    }
    /** Used by lists handler to create a list inside a folder */
    async getFolderWithSpace(folderId) {
        const r = await this.db.query(`SELECT f.id, f.space_id, s.workspace_id
       FROM folders f
       JOIN spaces s ON s.id = f.space_id
       WHERE f.id = $1 AND s.deleted_at IS NULL`, [folderId]);
        return r.rows[0] ?? null;
    }
}
//# sourceMappingURL=folders.repository.js.map