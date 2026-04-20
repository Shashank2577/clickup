import { Pool } from 'pg'

interface UserRow {
  id: string
  email: string
  name: string
  avatar_url: string | null
  timezone: string
  password_hash: string
  created_at: Date
}

interface SessionRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  created_at: Date
}

export class AuthRepository {
  constructor(private readonly db: Pool) {}

  async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, name, avatar_url, timezone, password_hash, created_at
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    )
    return result.rows[0] ?? null
  }

  async getUserById(id: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, name, avatar_url, timezone, password_hash, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return result.rows[0] ?? null
  }

  async createUser(input: {
    email: string
    name: string
    passwordHash: string
    timezone?: string
  }): Promise<UserRow> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (email, name, password_hash, timezone)
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, avatar_url, timezone, password_hash, created_at`,
      [input.email, input.name, input.passwordHash, input.timezone ?? 'UTC'],
    )
    if (!result.rows[0]) {
      throw new Error('Failed to create user')
    }
    return result.rows[0]
  }

  async createSession(input: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [input.id, input.userId, input.tokenHash, input.expiresAt],
    )
  }

  async getSession(sessionId: string): Promise<SessionRow | null> {
    const result = await this.db.query<SessionRow>(
      `SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()`,
      [sessionId],
    )
    return result.rows[0] ?? null
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.query(`DELETE FROM sessions WHERE id = $1`, [sessionId])
  }

  async updateSessionExpiry(sessionId: string, expiresAt: Date): Promise<void> {
    await this.db.query(`UPDATE sessions SET expires_at = $1 WHERE id = $2`, [expiresAt, sessionId])
  }
}
