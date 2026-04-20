export class AuthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getUserByEmail(email) {
        const result = await this.db.query(`SELECT id, email, name, avatar_url, timezone, password_hash, created_at
       FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
        return result.rows[0] ?? null;
    }
    async getUserById(id) {
        const result = await this.db.query(`SELECT id, email, name, avatar_url, timezone, password_hash, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return result.rows[0] ?? null;
    }
    async createUser(input) {
        const result = await this.db.query(`INSERT INTO users (email, name, password_hash, timezone)
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, avatar_url, timezone, password_hash, created_at`, [input.email, input.name, input.passwordHash, input.timezone ?? 'UTC']);
        if (!result.rows[0]) {
            throw new Error('Failed to create user');
        }
        return result.rows[0];
    }
    async createSession(input) {
        await this.db.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [input.id, input.userId, input.tokenHash, input.expiresAt]);
    }
    async getSession(sessionId) {
        const result = await this.db.query(`SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()`, [sessionId]);
        return result.rows[0] ?? null;
    }
    async deleteSession(sessionId) {
        await this.db.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    }
    async updateSessionExpiry(sessionId, expiresAt) {
        await this.db.query(`UPDATE sessions SET expires_at = $1 WHERE id = $2`, [expiresAt, sessionId]);
    }
}
//# sourceMappingURL=auth.repository.js.map