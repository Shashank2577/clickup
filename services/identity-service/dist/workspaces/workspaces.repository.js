export class WorkspacesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getWorkspaceBySlug(slug) {
        const r = await this.db.query(`SELECT id, name, slug, owner_id, logo_url, created_at FROM workspaces WHERE slug = $1 AND deleted_at IS NULL`, [slug]);
        return r.rows[0] ?? null;
    }
    async createWorkspace(client, input) {
        const r = await client.query(`INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3)
       RETURNING id, name, slug, owner_id, logo_url, created_at`, [input.name, input.slug, input.ownerId]);
        return r.rows[0];
    }
    async addMember(client, input) {
        const r = await client.query(`INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING workspace_id, user_id, role, joined_at`, [input.workspaceId, input.userId, input.role]);
        return r.rows[0];
    }
    async getWorkspace(id) {
        const r = await this.db.query(`SELECT id, name, slug, owner_id, logo_url, created_at FROM workspaces WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return r.rows[0] ?? null;
    }
    async getUserWorkspaces(userId) {
        const r = await this.db.query(`SELECT w.id, w.name, w.slug, w.owner_id, w.logo_url, w.created_at, wm.role, wm.joined_at
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.deleted_at IS NULL
       ORDER BY wm.joined_at ASC`, [userId]);
        return r.rows;
    }
    async updateWorkspace(id, input) {
        const r = await this.db.query(`UPDATE workspaces
       SET name = COALESCE($2, name), logo_url = COALESCE($3, logo_url)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, name, slug, owner_id, logo_url, created_at`, [id, input.name ?? null, input.logoUrl ?? null]);
        return r.rows[0];
    }
    async getMember(workspaceId, userId) {
        const r = await this.db.query(`SELECT workspace_id, user_id, role, joined_at FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
        return r.rows[0] ?? null;
    }
    async getMembers(workspaceId) {
        const r = await this.db.query(`SELECT workspace_id, user_id, role, joined_at FROM workspace_members
       WHERE workspace_id = $1 ORDER BY joined_at ASC`, [workspaceId]);
        return r.rows;
    }
    async removeMember(workspaceId, userId) {
        await this.db.query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
    }
    async updateMemberRole(workspaceId, userId, role) {
        await this.db.query(`UPDATE workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId, role]);
    }
    async getUserByEmail(email) {
        const r = await this.db.query(`SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
        return r.rows[0] ?? null;
    }
}
//# sourceMappingURL=workspaces.repository.js.map