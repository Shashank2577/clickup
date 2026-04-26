import { Pool } from 'pg'

export interface PreferencesRow {
  user_id: string
  accent_color: string
  appearance_mode: string
  high_contrast: boolean
  updated_at: Date
}

export class PreferencesRepository {
  constructor(private readonly db: Pool) {}

  async getPreferences(userId: string): Promise<PreferencesRow | null> {
    const r = await this.db.query<PreferencesRow>(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId],
    )
    return r.rows[0] ?? null
  }

  async upsertPreferences(
    userId: string,
    input: { accentColor?: string; appearanceMode?: string; highContrast?: boolean },
  ): Promise<PreferencesRow> {
    const r = await this.db.query<PreferencesRow>(
      `INSERT INTO user_preferences (user_id, accent_color, appearance_mode, high_contrast)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         accent_color = COALESCE($2, user_preferences.accent_color),
         appearance_mode = COALESCE($3, user_preferences.appearance_mode),
         high_contrast = COALESCE($4, user_preferences.high_contrast),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        input.accentColor ?? '#6366f1',
        input.appearanceMode ?? 'auto',
        input.highContrast ?? false,
      ],
    )
    return r.rows[0]!
  }
}
