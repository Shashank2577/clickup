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

export const sprintsRepository = {
  async getSprint(sprintId: string) {
    const result = await db.query(`
      SELECT
        s.*,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'taskId',   st.task_id,
              'addedAt',  st.added_at,
              'title',    t.title,
              'status',   t.status,
              'priority', t.priority,
              'sprint_points', t.sprint_points
            ) ORDER BY st.added_at ASC
          ) FILTER (WHERE st.task_id IS NOT NULL),
          '[]'
        ) AS tasks
      FROM sprints s
      LEFT JOIN sprint_tasks st ON st.sprint_id = s.id
      LEFT JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
      WHERE s.id = $1
      GROUP BY s.id
    `, [sprintId])
    return result.rows[0] || null
  },

  async getSprintsForList(listId: string) {
    const result = await db.query(`
      SELECT
        s.*,
        COUNT(st.task_id) AS task_count
      FROM sprints s
      LEFT JOIN sprint_tasks st ON st.sprint_id = s.id
      WHERE s.list_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [listId])
    return result.rows
  },

  async createSprint(
    listId: string,
    name: string,
    goal: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    createdBy: string,
  ) {
    const result = await db.query(`
      INSERT INTO sprints (list_id, name, goal, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [listId, name, goal ?? null, startDate ?? null, endDate ?? null, createdBy])
    return result.rows[0]
  },

  async updateSprint(
    sprintId: string,
    name?: string,
    goal?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const result = await db.query(`
      UPDATE sprints
      SET name       = COALESCE($2, name),
          goal       = COALESCE($3, goal),
          start_date = COALESCE($4, start_date),
          end_date   = COALESCE($5, end_date),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [sprintId, name ?? null, goal ?? null, startDate ?? null, endDate ?? null])
    return result.rows[0] || null
  },

  async deleteSprint(sprintId: string) {
    await db.query('DELETE FROM sprints WHERE id = $1', [sprintId])
  },

  async setSprintStatus(sprintId: string, status: 'planning' | 'active' | 'completed', velocity?: number) {
    const result = await db.query(`
      UPDATE sprints
      SET status     = $2,
          velocity   = COALESCE($3, velocity),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [sprintId, status, velocity ?? null])
    return result.rows[0] || null
  },

  async addTasksToSprint(sprintId: string, taskIds: string[]) {
    if (taskIds.length === 0) return
    const values = taskIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await db.query(
      `INSERT INTO sprint_tasks (sprint_id, task_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [sprintId, ...taskIds],
    )
  },

  async removeTaskFromSprint(sprintId: string, taskId: string) {
    await db.query(
      'DELETE FROM sprint_tasks WHERE sprint_id = $1 AND task_id = $2',
      [sprintId, taskId],
    )
  },

  async getSprintStats(sprintId: string) {
    // Fetch sprint metadata for burndown date range
    const sprintResult = await db.query(`
      SELECT start_date, end_date FROM sprints WHERE id = $1
    `, [sprintId])
    const sprint = sprintResult.rows[0]

    // Aggregate task-level stats: join with list_statuses to check is_closed
    const statsResult = await db.query(`
      SELECT
        COUNT(t.id)::int                                         AS total_tasks,
        COALESCE(SUM(t.sprint_points), 0)::int                  AS total_points,
        COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL)::int AS completed_tasks,
        COALESCE(SUM(t.sprint_points) FILTER (WHERE t.completed_at IS NOT NULL), 0)::int AS completed_points
      FROM sprint_tasks st
      JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
      WHERE st.sprint_id = $1
    `, [sprintId])

    const stats = statsResult.rows[0]

    // Burndown: per-day remaining points over the sprint window
    let burndown: Array<{ date: string; remaining: number }> = []
    if (sprint?.start_date && sprint?.end_date) {
      const burndownResult = await db.query(`
        WITH RECURSIVE date_series AS (
          SELECT $2::date AS day
          UNION ALL
          SELECT (day + interval '1 day')::date
          FROM date_series
          WHERE day < $3::date
        ),
        completions AS (
          SELECT
            t.completed_at::date AS completed_day,
            COALESCE(SUM(t.sprint_points), 0) AS points_done
          FROM sprint_tasks st
          JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
          WHERE st.sprint_id = $1
            AND t.completed_at IS NOT NULL
          GROUP BY t.completed_at::date
        )
        SELECT
          ds.day::text AS date,
          ($4 - COALESCE(SUM(c.points_done) OVER (ORDER BY ds.day ROWS UNBOUNDED PRECEDING), 0))::int AS remaining
        FROM date_series ds
        LEFT JOIN completions c ON c.completed_day = ds.day
        ORDER BY ds.day
      `, [sprintId, sprint.start_date, sprint.end_date, stats.total_points])
      burndown = burndownResult.rows
    }

    return {
      totalTasks: stats.total_tasks,
      completedTasks: stats.completed_tasks,
      totalPoints: stats.total_points,
      completedPoints: stats.completed_points,
      burndown,
    }
  },

  async getSprintForList(sprintId: string, listId: string) {
    const result = await db.query(
      'SELECT * FROM sprints WHERE id = $1 AND list_id = $2',
      [sprintId, listId],
    )
    return result.rows[0] || null
  },
}
