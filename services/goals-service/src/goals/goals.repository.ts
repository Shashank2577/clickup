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

export const goalsRepository = {
  async getGoal(goalId: string) {
    const result = await db.query(`
      SELECT
        g.*,
        json_agg(
          jsonb_build_object(
            'id',           gt.id,
            'goalId',       gt.goal_id,
            'name',         gt.name,
            'type',         gt.type,
            'targetValue',  gt.target_value,
            'currentValue', gt.current_value,
            'taskId',       gt.task_id,
            'createdAt',    gt.created_at,
            'updatedAt',    gt.updated_at
          ) ORDER BY gt.created_at ASC
        ) FILTER (WHERE gt.id IS NOT NULL) AS targets
      FROM goals g
      LEFT JOIN goal_targets gt ON gt.goal_id = g.id
      WHERE g.id = $1
        AND g.deleted_at IS NULL
      GROUP BY g.id
    `, [goalId])
    return result.rows[0] || null
  },

  async getGoalsForWorkspace(workspaceId: string) {
    const result = await db.query(`
      SELECT
        g.*,
        json_agg(
          jsonb_build_object(
            'id',           gt.id,
            'goalId',       gt.goal_id,
            'name',         gt.name,
            'type',         gt.type,
            'targetValue',  gt.target_value,
            'currentValue', gt.current_value,
            'taskId',       gt.task_id,
            'createdAt',    gt.created_at,
            'updatedAt',    gt.updated_at
          ) ORDER BY gt.created_at ASC
        ) FILTER (WHERE gt.id IS NOT NULL) AS targets
      FROM goals g
      LEFT JOIN goal_targets gt ON gt.goal_id = g.id
      WHERE g.workspace_id = $1
        AND g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `, [workspaceId])
    return result.rows
  },

  async createGoal(workspaceId: string, name: string, description: string | undefined | null, dueDate: string | undefined | null, ownerId: string, color: string | undefined | null) {
    const result = await db.query(`
      INSERT INTO goals (workspace_id, name, description, due_date, owner_id, color)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#6366f1'))
      RETURNING *
    `, [workspaceId, name, description || null, dueDate || null, ownerId, color])
    return result.rows[0]
  },

  async updateGoal(goalId: string, name?: string, description?: string, dueDate?: string, color?: string) {
    const result = await db.query(`
      UPDATE goals
      SET name        = COALESCE($2, name),
          description = COALESCE($3, description),
          due_date    = COALESCE($4, due_date),
          color       = COALESCE($5, color),
          updated_at  = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *
    `, [goalId, name, description, dueDate, color])
    return result.rows[0] || null
  },

  async deleteGoal(goalId: string) {
    await db.query(`
      UPDATE goals
      SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
    `, [goalId])
  },

  async getTargetsForGoal(goalId: string) {
    const result = await db.query(`
      SELECT
        id,
        goal_id as "goalId",
        name,
        type,
        target_value as "targetValue",
        current_value as "currentValue",
        task_id as "taskId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM goal_targets
      WHERE goal_id = $1
      ORDER BY created_at ASC
    `, [goalId])
    return result.rows
  },

  async getTarget(targetId: string, goalId: string) {
    const result = await db.query(`
      SELECT
        id,
        goal_id as "goalId",
        name,
        type,
        target_value as "targetValue",
        current_value as "currentValue",
        task_id as "taskId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM goal_targets
      WHERE id = $1 AND goal_id = $2
    `, [targetId, goalId])
    return result.rows[0] || null
  },

  async createTarget(goalId: string, name: string, type: string, targetValue?: number, currentValue?: number, taskId?: string) {
    const result = await db.query(`
      INSERT INTO goal_targets (goal_id, name, type, target_value, current_value, task_id)
      VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6)
      RETURNING
        id,
        goal_id as "goalId",
        name,
        type,
        target_value as "targetValue",
        current_value as "currentValue",
        task_id as "taskId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [goalId, name, type, targetValue || null, currentValue, taskId || null])
    return result.rows[0]
  },

  async updateTarget(targetId: string, goalId: string, name?: string, currentValue?: number, targetValue?: number, taskId?: string) {
    const result = await db.query(`
      UPDATE goal_targets
      SET name          = COALESCE($3, name),
          current_value = COALESCE($4, current_value),
          target_value  = COALESCE($5, target_value),
          task_id       = COALESCE($6, task_id),
          updated_at    = NOW()
      WHERE id = $1
        AND goal_id = $2
      RETURNING
        id,
        goal_id as "goalId",
        name,
        type,
        target_value as "targetValue",
        current_value as "currentValue",
        task_id as "taskId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [targetId, goalId, name, currentValue, targetValue, taskId])
    return result.rows[0] || null
  },

  async getTaskWithWorkspace(taskId: string): Promise<{ workspaceId: string } | null> {
    const result = await db.query<{ workspace_id: string }>(`
      SELECT s.workspace_id
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      JOIN spaces s ON s.id = l.space_id
      WHERE t.id = $1
        AND t.deleted_at IS NULL
    `, [taskId])
    if (!result.rows[0]) return null
    return { workspaceId: result.rows[0].workspace_id }
  }
}
