export class AuthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getUserByEmail(email) {
        const result = await this.db.query(`SELECT id, email, name, avatar_url, timezone, password_hash, email_verified, created_at
       FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
        return result.rows[0] ?? null;
    }
    async getUserById(id) {
        const result = await this.db.query(`SELECT id, email, name, avatar_url, timezone, password_hash, email_verified, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return result.rows[0] ?? null;
    }
    async createUser(input) {
        const result = await this.db.query(`INSERT INTO users (email, name, password_hash, timezone)
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, avatar_url, timezone, password_hash, email_verified, created_at`, [input.email, input.name, input.passwordHash, input.timezone ?? 'UTC']);
        if (!result.rows[0]) {
            throw new Error('Failed to create user');
        }
        return result.rows[0];
    }
    // ============================================================
    // Password Reset Tokens
    // ============================================================
    async createPasswordResetToken(userId) {
        const result = await this.db.query(`INSERT INTO password_reset_tokens (user_id)
       VALUES ($1)
       RETURNING id, user_id, token, expires_at, used_at, created_at`, [userId]);
        if (!result.rows[0])
            throw new Error('Failed to create password reset token');
        return result.rows[0];
    }
    async getPasswordResetToken(token) {
        const result = await this.db.query(`SELECT id, user_id, token, expires_at, used_at, created_at
       FROM password_reset_tokens WHERE token = $1`, [token]);
        return result.rows[0] ?? null;
    }
    async markPasswordResetTokenUsed(id) {
        await this.db.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [id]);
    }
    async updatePasswordHash(userId, passwordHash) {
        await this.db.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, passwordHash]);
    }
    // ============================================================
    // Email Verification Tokens
    // ============================================================
    async createEmailVerificationToken(userId) {
        const result = await this.db.query(`INSERT INTO email_verification_tokens (user_id)
       VALUES ($1)
       RETURNING id, user_id, token, expires_at, verified_at, created_at`, [userId]);
        if (!result.rows[0])
            throw new Error('Failed to create email verification token');
        return result.rows[0];
    }
    async getEmailVerificationToken(token) {
        const result = await this.db.query(`SELECT id, user_id, token, expires_at, verified_at, created_at
       FROM email_verification_tokens WHERE token = $1`, [token]);
        return result.rows[0] ?? null;
    }
    async markEmailVerified(userId, tokenId) {
        await this.db.query(`UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`, [userId]);
        await this.db.query(`UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1`, [tokenId]);
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