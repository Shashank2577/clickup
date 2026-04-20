export class UsersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getUserById(id) {
        const result = await this.db.query(`SELECT id, email, name, avatar_url, timezone, password_hash, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return result.rows[0] ?? null;
    }
    async updateUser(id, input) {
        const result = await this.db.query(`UPDATE users
       SET name = COALESCE($2, name),
           avatar_url = COALESCE($3, avatar_url),
           timezone = COALESCE($4, timezone),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email, name, avatar_url, timezone, created_at, updated_at`, [id, input.name ?? null, input.avatarUrl ?? null, input.timezone ?? null]);
        if (!result.rows[0])
            throw new Error('User not found after update');
        return result.rows[0];
    }
    async updatePasswordHash(id, hash) {
        await this.db.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [id, hash]);
    }
    async deleteAllSessionsExcept(userId, sessionId) {
        await this.db.query(`DELETE FROM sessions WHERE user_id = $1 AND id != $2`, [userId, sessionId]);
    }
    async batchGetUsers(ids) {
        if (ids.length === 0)
            return [];
        const result = await this.db.query(`SELECT id, name, email, avatar_url, timezone, password_hash, created_at, updated_at FROM users
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`, [ids]);
        return result.rows;
    }
}
//# sourceMappingURL=users.repository.js.map