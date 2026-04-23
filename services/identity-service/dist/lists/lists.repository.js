const DEFAULT_STATUSES = [
    { name: 'Backlog', color: '#94a3b8', group: 'backlog', position: 0, isDefault: false },
    { name: 'Todo', color: '#64748b', group: 'unstarted', position: 1000, isDefault: true },
    { name: 'In Progress', color: '#3b82f6', group: 'started', position: 2000, isDefault: false },
    { name: 'Done', color: '#22c55e', group: 'completed', position: 3000, isDefault: false },
    { name: 'Cancelled', color: '#ef4444', group: 'cancelled', position: 4000, isDefault: false },
];
export class ListsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createList(input) {
        const r = await this.db.query(`INSERT INTO lists (space_id, name, color, position, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [input.spaceId, input.name, input.color ?? null, input.position, input.createdBy]);
        return r.rows[0];
    }
    async createListInFolder(input) {
        const r = await this.db.query(`INSERT INTO lists (space_id, folder_id, name, color, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [input.spaceId, input.folderId, input.name, input.color ?? null, input.position, input.createdBy]);
        return r.rows[0];
    }
    async getListsByFolder(folderId) {
        const r = await this.db.query(`SELECT * FROM lists WHERE folder_id = $1 AND deleted_at IS NULL ORDER BY position ASC`, [folderId]);
        return r.rows;
    }
    async seedDefaultStatuses(listId) {
        for (const s of DEFAULT_STATUSES) {
            await this.db.query(`INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`, [listId, s.name, s.color, s.group, s.position, s.isDefault]);
        }
    }
    async getList(id) {
        const r = await this.db.query(`SELECT l.*, s.workspace_id
       FROM lists l JOIN spaces s ON s.id = l.space_id
       WHERE l.id = $1 AND l.deleted_at IS NULL AND s.deleted_at IS NULL`, [id]);
        return r.rows[0] ?? null;
    }
    async getListsBySpace(spaceId) {
        const r = await this.db.query(`SELECT * FROM lists WHERE space_id = $1 AND deleted_at IS NULL ORDER BY position ASC`, [spaceId]);
        return r.rows;
    }
    async updateList(id, input) {
        const r = await this.db.query(`UPDATE lists
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           is_archived = COALESCE($4, is_archived)
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`, [id, input.name ?? null, input.color ?? null, input.isArchived ?? null]);
        return r.rows[0];
    }
    async softDeleteList(id) {
        await this.db.query(`UPDATE lists SET deleted_at = NOW() WHERE id = $1`, [id]);
    }
    async getMaxPosition(spaceId) {
        const r = await this.db.query(`SELECT COALESCE(MAX(position), 0) AS max FROM lists WHERE space_id = $1 AND deleted_at IS NULL`, [spaceId]);
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
}
//# sourceMappingURL=lists.repository.js.map