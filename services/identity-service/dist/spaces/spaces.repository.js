export class SpacesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createSpace(input) {
        const r = await this.db.query(`INSERT INTO spaces (workspace_id, name, color, icon, is_private, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [input.workspaceId, input.name, input.color ?? null, input.icon ?? null,
            input.isPrivate ?? false, input.position, input.createdBy]);
        return r.rows[0];
    }
    async getSpace(id) {
        const r = await this.db.query(`SELECT * FROM spaces WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return r.rows[0] ?? null;
    }
    async getSpacesByWorkspace(workspaceId, userId) {
        const r = await this.db.query(`SELECT * FROM spaces
       WHERE workspace_id = $1 AND deleted_at IS NULL
         AND (is_private = FALSE OR created_by = $2)
       ORDER BY position ASC`, [workspaceId, userId]);
        return r.rows;
    }
    async updateSpace(id, input) {
        const r = await this.db.query(`UPDATE spaces
       SET name = COALESCE($2, name),
           color = COALESCE($3, color),
           icon = COALESCE($4, icon)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`, [id, input.name ?? null, input.color ?? null, input.icon ?? null]);
        return r.rows[0];
    }
    async softDeleteSpace(id, client) {
        const q = client ?? this.db;
        await q.query(`UPDATE spaces SET deleted_at = NOW() WHERE id = $1`, [id]);
    }
    async softDeleteListsBySpace(spaceId, client) {
        const q = client ?? this.db;
        await q.query(`UPDATE lists SET deleted_at = NOW() WHERE space_id = $1 AND deleted_at IS NULL`, [spaceId]);
    }
    async getMaxPosition(workspaceId) {
        const r = await this.db.query(`SELECT COALESCE(MAX(position), 0) AS max FROM spaces WHERE workspace_id = $1 AND deleted_at IS NULL`, [workspaceId]);
        return r.rows[0].max;
    }
    async getWorkspaceMember(workspaceId, userId) {
        const r = await this.db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
        return r.rows[0] ?? null;
    }
}
//# sourceMappingURL=spaces.repository.js.map