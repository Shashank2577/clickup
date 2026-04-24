import { Pool } from 'pg'

export const db = new Pool({
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  database: process.env['POSTGRES_DB'] ?? 'clickup',
  user: process.env['POSTGRES_USER'] ?? 'clickup',
  password: process.env['POSTGRES_PASSWORD'] ?? 'clickup_dev',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const dashboardsRepository = {
  async getDashboard(dashboardId: string) {
    const result = await db.query(
      `
      SELECT
        d.*,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id',          w.id,
              'dashboardId', w.dashboard_id,
              'type',        w.type,
              'title',       w.title,
              'config',      w.config,
              'positionX',   w.position_x,
              'positionY',   w.position_y,
              'width',       w.width,
              'height',      w.height,
              'createdAt',   w.created_at,
              'updatedAt',   w.updated_at
            ) ORDER BY w.position_y ASC, w.position_x ASC
          ) FILTER (WHERE w.id IS NOT NULL),
          '[]'
        ) AS widgets
      FROM dashboards d
      LEFT JOIN dashboard_widgets w ON w.dashboard_id = d.id
      WHERE d.id = $1
      GROUP BY d.id
      `,
      [dashboardId],
    )
    return result.rows[0] ?? null
  },

  async getDashboardsForWorkspace(workspaceId: string, userId: string) {
    const result = await db.query(
      `
      SELECT
        d.id,
        d.workspace_id,
        d.name,
        d.is_private,
        d.owner_id,
        d.created_at,
        d.updated_at,
        COUNT(w.id)::int AS widget_count
      FROM dashboards d
      LEFT JOIN dashboard_widgets w ON w.dashboard_id = d.id
      WHERE d.workspace_id = $1
        AND (d.is_private = false OR d.owner_id = $2)
      GROUP BY d.id
      ORDER BY d.created_at DESC
      `,
      [workspaceId, userId],
    )
    return result.rows
  },

  async createDashboard(
    workspaceId: string,
    name: string,
    isPrivate: boolean,
    ownerId: string,
  ) {
    const result = await db.query(
      `
      INSERT INTO dashboards (workspace_id, name, is_private, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [workspaceId, name, isPrivate, ownerId],
    )
    return result.rows[0]
  },

  async updateDashboard(
    dashboardId: string,
    name?: string,
    isPrivate?: boolean,
  ) {
    const result = await db.query(
      `
      UPDATE dashboards
      SET name       = COALESCE($2, name),
          is_private = COALESCE($3, is_private),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [dashboardId, name ?? null, isPrivate ?? null],
    )
    return result.rows[0] ?? null
  },

  async deleteDashboard(dashboardId: string) {
    await db.query(`DELETE FROM dashboards WHERE id = $1`, [dashboardId])
  },
}
