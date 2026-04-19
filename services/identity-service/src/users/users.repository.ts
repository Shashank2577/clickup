import { Pool } from 'pg'

export interface UserRow {
  id: string
  email: string
  name: string
  avatar_url: string | null
  timezone: string
  password_hash: string
  created_at: Date
  updated_at: Date
}

export class UsersRepository {
  constructor(private readonly db: Pool) {}

  async getUserById(id: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, name, avatar_url, timezone, password_hash, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return result.rows[0] ?? null
  }

  async updateUser(
    id: string,
    input: { name?: string; avatarUrl?: string; timezone?: string },
  ): Promise<Omit<UserRow, 'password_hash'>> {
    const result = await this.db.query<Omit<UserRow, 'password_hash'>>(
      `UPDATE users
       SET name = COALESCE($2, name),
           avatar_url = COALESCE($3, avatar_url),
           timezone = COALESCE($4, timezone),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email, name, avatar_url, timezone, created_at, updated_at`,
      [id, input.name ?? null, input.avatarUrl ?? null, input.timezone ?? null],
    )
    if (!result.rows[0]) throw new Error('User not found after update')
    return result.rows[0]
  }

  async updatePasswordHash(id: string, hash: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [id, hash],
    )
  }

  async deleteAllSessionsExcept(userId: string, sessionId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM sessions WHERE user_id = $1 AND id != $2`,
      [userId, sessionId],
    )
  }

  async batchGetUsers(ids: string[]): Promise<Pick<UserRow, 'id' | 'email' | 'name' | 'avatar_url'>[]> {
    if (ids.length === 0) return []
    const result = await this.db.query<Pick<UserRow, 'id' | 'email' | 'name' | 'avatar_url'>>(
      `SELECT id, name, email, avatar_url FROM users
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids],
    )
    return result.rows
  }
}
