import { Pool } from 'pg'

export interface FavoriteRow {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  position: number
  created_at: Date
}

export class FavoritesRepository {
  constructor(private readonly db: Pool) {}

  async addFavorite(input: {
    userId: string
    entityType: string
    entityId: string
    position: number
  }): Promise<FavoriteRow> {
    const r = await this.db.query<FavoriteRow>(
      `INSERT INTO favorites (user_id, entity_type, entity_id, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.userId, input.entityType, input.entityId, input.position],
    )
    return r.rows[0]!
  }

  async getFavoritesByUser(userId: string): Promise<FavoriteRow[]> {
    const r = await this.db.query<FavoriteRow>(
      `SELECT * FROM favorites WHERE user_id = $1 ORDER BY position ASC`,
      [userId],
    )
    return r.rows
  }

  async getFavoriteById(id: string): Promise<FavoriteRow | null> {
    const r = await this.db.query<FavoriteRow>(
      `SELECT * FROM favorites WHERE id = $1`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async existsFavorite(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [userId, entityType, entityId],
    )
    return parseInt(r.rows[0]!.count, 10) > 0
  }

  async deleteFavorite(id: string): Promise<void> {
    await this.db.query(`DELETE FROM favorites WHERE id = $1`, [id])
  }

  async getMaxPosition(userId: string): Promise<number> {
    const r = await this.db.query<{ max: number }>(
      `SELECT COALESCE(MAX(position), 0) AS max FROM favorites WHERE user_id = $1`,
      [userId],
    )
    return r.rows[0]!.max
  }

  async reorderFavorites(userId: string, orderedIds: string[]): Promise<void> {
    // Update position for each favorite in the new order
    const values = orderedIds.map((id, idx) => `('${id}'::uuid, ${idx * 1000})`).join(', ')
    await this.db.query(
      `UPDATE favorites AS f
       SET position = v.new_position
       FROM (VALUES ${values}) AS v(fav_id, new_position)
       WHERE f.id = v.fav_id AND f.user_id = $1`,
      [userId],
    )
  }
}
