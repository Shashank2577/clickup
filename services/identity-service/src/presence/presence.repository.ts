import { Pool } from 'pg'

export interface PresenceRow {
  user_id: string
  status: string
  last_seen_at: Date
  updated_at: Date
}

export class PresenceRepository {
  constructor(private readonly db: Pool) {}

  async upsertPresence(userId: string, status: string): Promise<PresenceRow> {
    const r = await this.db.query<PresenceRow>(
      `INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET status = $2, last_seen_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [userId, status],
    )
    return r.rows[0]!
  }

  async getPresenceByUserIds(userIds: string[]): Promise<PresenceRow[]> {
    if (userIds.length === 0) return []
    const r = await this.db.query<PresenceRow>(
      `SELECT * FROM user_presence WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    )
    return r.rows
  }

  async getPresence(userId: string): Promise<PresenceRow | null> {
    const r = await this.db.query<PresenceRow>(
      `SELECT * FROM user_presence WHERE user_id = $1`,
      [userId],
    )
    return r.rows[0] ?? null
  }
}
