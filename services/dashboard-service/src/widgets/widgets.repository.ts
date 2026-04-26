import type { Pool } from 'pg'
import type { WidgetType } from '@clickup/contracts'

// ============================================================
// Widgets repository — CRUD + data computation queries
// ============================================================

export const widgetsRepository = {
  async getWidget(db: Pool, widgetId: string) {
    const result = await db.query(
      `
      SELECT
        id,
        dashboard_id  AS "dashboardId",
        type,
        title,
        config,
        position_x    AS "positionX",
        position_y    AS "positionY",
        width,
        height,
        created_at    AS "createdAt",
        updated_at    AS "updatedAt"
      FROM dashboard_widgets
      WHERE id = $1
      `,
      [widgetId],
    )
    return result.rows[0] ?? null
  },

  async createWidget(
    db: Pool,
    dashboardId: string,
    type: WidgetType,
    title: string,
    config: Record<string, unknown>,
    positionX: number,
    positionY: number,
    width: number,
    height: number,
  ) {
    const result = await db.query(
      `
      INSERT INTO dashboard_widgets
        (dashboard_id, type, title, config, position_x, position_y, width, height)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        dashboard_id  AS "dashboardId",
        type,
        title,
        config,
        position_x    AS "positionX",
        position_y    AS "positionY",
        width,
        height,
        created_at    AS "createdAt",
        updated_at    AS "updatedAt"
      `,
      [dashboardId, type, title, JSON.stringify(config), positionX, positionY, width, height],
    )
    return result.rows[0]
  },

  async updateWidget(
    db: Pool,
    widgetId: string,
    title?: string,
    config?: Record<string, unknown>,
    positionX?: number,
    positionY?: number,
    width?: number,
    height?: number,
  ) {
    const result = await db.query(
      `
      UPDATE dashboard_widgets
      SET title      = COALESCE($2, title),
          config     = COALESCE($3, config),
          position_x = COALESCE($4, position_x),
          position_y = COALESCE($5, position_y),
          width      = COALESCE($6, width),
          height     = COALESCE($7, height),
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        dashboard_id  AS "dashboardId",
        type,
        title,
        config,
        position_x    AS "positionX",
        position_y    AS "positionY",
        width,
        height,
        created_at    AS "createdAt",
        updated_at    AS "updatedAt"
      `,
      [
        widgetId,
        title ?? null,
        config !== undefined ? JSON.stringify(config) : null,
        positionX ?? null,
        positionY ?? null,
        width ?? null,
        height ?? null,
      ],
    )
    return result.rows[0] ?? null
  },

  async deleteWidget(db: Pool, widgetId: string) {
    await db.query(`DELETE FROM dashboard_widgets WHERE id = $1`, [widgetId])
  },

  // ============================================================
  // Widget data computation
  // ============================================================

  async computeWidgetData(
    db: Pool,
    type: WidgetType,
    config: Record<string, unknown>,
    workspaceId: string,
  ): Promise<unknown> {
    switch (type) {
      case 'task_count':
        return computeTaskCount(db, config, workspaceId)
      case 'task_by_status':
        return computeTaskByStatus(db, config, workspaceId)
      case 'task_by_assignee':
        return computeTaskByAssignee(db, config, workspaceId)
      case 'task_by_priority':
        return computeTaskByPriority(db, config, workspaceId)
      case 'completion_rate':
        return computeCompletionRate(db, config, workspaceId)
      case 'time_tracked':
        return computeTimeTracked(db, config, workspaceId)
      case 'time_by_user':
        return computeTimeByUser(db, config, workspaceId)
      case 'billable_time':
        return computeBillableTime(db, config, workspaceId)
      case 'overdue_tasks':
        return computeOverdueTasks(db, config, workspaceId)
      case 'custom_text':
        return { text: (config['text'] as string) ?? '' }
      case 'embed':
        return { url: (config['url'] as string) ?? '' }
      case 'velocity':
        return computeVelocity(db, config, workspaceId)
      case 'burndown':
        return computeBurndown(db, config)
      case 'cumulative_flow':
        return computeCumulativeFlow(db, config, workspaceId)
      case 'recent_activity':
        return computeRecentActivity(db, config, workspaceId)
      case 'goals_progress':
        return computeGoalsProgress(db, workspaceId)
      case 'burnup':
        return computeBurnup(db, config)
      default: {
        const _exhaustive: never = type
        return { message: `Unknown widget type: ${String(_exhaustive)}` }
      }
    }
  },
}

// ============================================================
// Helpers — scope filters
// ============================================================

/** Builds a WHERE clause fragment and params array for task-scoped queries */
function buildTaskScope(
  config: Record<string, unknown>,
  workspaceId: string,
  startParamIdx: number,
): { clause: string; params: unknown[] } {
  const params: unknown[] = [workspaceId]
  const conditions: string[] = [
    `t.deleted_at IS NULL`,
    `s.workspace_id = $1`,
  ]
  let idx = startParamIdx

  if (config['listId']) {
    params.push(config['listId'])
    conditions.push(`t.list_id = $${idx++}`)
  } else if (config['spaceId']) {
    params.push(config['spaceId'])
    conditions.push(`l.space_id = $${idx++}`)
  }

  if (config['statuses'] && Array.isArray(config['statuses']) && config['statuses'].length > 0) {
    params.push(config['statuses'])
    conditions.push(`t.status = ANY($${idx++})`)
  }

  return { clause: conditions.join(' AND '), params }
}

/** Builds a WHERE clause fragment for time_entries-scoped queries */
function buildTimeScope(
  config: Record<string, unknown>,
  workspaceId: string,
  startParamIdx: number,
): { clause: string; params: unknown[] } {
  const params: unknown[] = [workspaceId]
  const conditions: string[] = [
    `te.task_id IS NOT NULL`,
    `s.workspace_id = $1`,
  ]
  let idx = startParamIdx

  if (config['listId']) {
    params.push(config['listId'])
    conditions.push(`t.list_id = $${idx++}`)
  } else if (config['spaceId']) {
    params.push(config['spaceId'])
    conditions.push(`l.space_id = $${idx++}`)
  }

  if (config['startDate']) {
    params.push(config['startDate'])
    conditions.push(`te.started_at >= $${idx++}`)
  }

  if (config['endDate']) {
    params.push(config['endDate'])
    conditions.push(`te.started_at <= $${idx++}`)
  }

  return { clause: conditions.join(' AND '), params }
}

// ============================================================
// Widget computation functions
// ============================================================

async function computeTaskCount(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<{ count: number }> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const result = await db.query<{ count: string }>(
    `
    SELECT COUNT(t.id)::text AS count
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    `,
    params,
  )
  return { count: parseInt(result.rows[0]?.count ?? '0', 10) }
}

async function computeTaskByStatus(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<Array<{ status: string; count: number }>> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const result = await db.query<{ status: string; count: string }>(
    `
    SELECT t.status, COUNT(t.id)::text AS count
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    GROUP BY t.status
    ORDER BY count DESC
    `,
    params,
  )
  return result.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) }))
}

async function computeTaskByAssignee(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<Array<{ assigneeId: string | null; count: number }>> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const result = await db.query<{ assignee_id: string | null; count: string }>(
    `
    SELECT t.assignee_id, COUNT(t.id)::text AS count
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    GROUP BY t.assignee_id
    ORDER BY count DESC
    `,
    params,
  )
  return result.rows.map((r) => ({
    assigneeId: r.assignee_id,
    count: parseInt(r.count, 10),
  }))
}

async function computeTaskByPriority(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<Array<{ priority: string | null; count: number }>> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const result = await db.query<{ priority: string | null; count: string }>(
    `
    SELECT t.priority, COUNT(t.id)::text AS count
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    GROUP BY t.priority
    ORDER BY count DESC
    `,
    params,
  )
  return result.rows.map((r) => ({
    priority: r.priority,
    count: parseInt(r.count, 10),
  }))
}

async function computeCompletionRate(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<{ total: number; completed: number; rate: number }> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const result = await db.query<{ total: string; completed: string }>(
    `
    SELECT
      COUNT(t.id)::text                                           AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'closed')::text       AS completed
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    `,
    params,
  )
  const total = parseInt(result.rows[0]?.total ?? '0', 10)
  const completed = parseInt(result.rows[0]?.completed ?? '0', 10)
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total, completed, rate }
}

async function computeTimeTracked(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<{ totalMinutes: number }> {
  const { clause, params } = buildTimeScope(config, workspaceId, 2)
  const result = await db.query<{ total: string }>(
    `
    SELECT COALESCE(SUM(te.duration_minutes), 0)::text AS total
    FROM time_entries te
    JOIN tasks t ON t.id = te.task_id
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    `,
    params,
  )
  return { totalMinutes: parseInt(result.rows[0]?.total ?? '0', 10) }
}

async function computeTimeByUser(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<Array<{ userId: string; totalMinutes: number }>> {
  const { clause, params } = buildTimeScope(config, workspaceId, 2)
  const result = await db.query<{ user_id: string; total: string }>(
    `
    SELECT te.user_id, COALESCE(SUM(te.duration_minutes), 0)::text AS total
    FROM time_entries te
    JOIN tasks t ON t.id = te.task_id
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${clause}
    GROUP BY te.user_id
    ORDER BY total DESC
    `,
    params,
  )
  return result.rows.map((r) => ({
    userId: r.user_id,
    totalMinutes: parseInt(r.total, 10),
  }))
}

async function computeBillableTime(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<{ totalMinutes: number }> {
  const { clause, params } = buildTimeScope(config, workspaceId, 2)
  const billableClause = `${clause} AND te.billable = true`
  const result = await db.query<{ total: string }>(
    `
    SELECT COALESCE(SUM(te.duration_minutes), 0)::text AS total
    FROM time_entries te
    JOIN tasks t ON t.id = te.task_id
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${billableClause}
    `,
    params,
  )
  return { totalMinutes: parseInt(result.rows[0]?.total ?? '0', 10) }
}

async function computeOverdueTasks(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<{ count: number }> {
  const { clause, params } = buildTaskScope(config, workspaceId, 2)
  const overdueClause = `${clause} AND t.due_date < NOW() AND t.status != 'closed'`
  const result = await db.query<{ count: string }>(
    `
    SELECT COUNT(t.id)::text AS count
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE ${overdueClause}
    `,
    params,
  )
  return { count: parseInt(result.rows[0]?.count ?? '0', 10) }
}

// ============================================================
// Sprint velocity — completed story points per sprint
// ============================================================

async function computeVelocity(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<unknown> {
  const listId = config['listId'] as string | undefined
  const limit = (config['sprintCount'] as number | undefined) ?? 5
  const whereClause = listId ? 'AND s.list_id = $2' : ''
  const params: unknown[] = [workspaceId]
  if (listId) params.push(listId)
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.status,
            COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'completed'), 0) as completed_points,
            COALESCE(SUM(t.story_points), 0) as total_points,
            s.start_date, s.end_date
     FROM sprints s
     LEFT JOIN sprint_tasks st ON st.sprint_id = s.id
     LEFT JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
     JOIN lists l ON l.id = s.list_id
     JOIN spaces sp ON sp.id = l.space_id
     JOIN workspaces w ON w.id = sp.workspace_id
     WHERE w.id = $1 ${whereClause} AND s.status = 'completed'
     GROUP BY s.id
     ORDER BY s.end_date DESC
     LIMIT $${params.length + 1}`,
    [...params, limit],
  )
  return {
    sprints: rows.reverse(),
    average: rows.length > 0
      ? Math.round(rows.reduce((s: number, r: any) => s + parseFloat(r.completed_points), 0) / rows.length)
      : 0,
  }
}

// ============================================================
// Burndown — daily remaining story points for a sprint
// ============================================================

async function computeBurndown(
  db: Pool,
  config: Record<string, unknown>,
): Promise<unknown> {
  const sprintId = config['sprintId'] as string | undefined
  if (!sprintId) return { error: 'sprintId required in widget config' }

  const { rows: sprintRows } = await db.query('SELECT * FROM sprints WHERE id = $1', [sprintId])
  const sprint = sprintRows[0]
  if (!sprint) return { error: 'Sprint not found' }

  const { rows: taskRows } = await db.query(
    `SELECT t.story_points, t.completed_at::date as completed_date
     FROM sprint_tasks st
     JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
     WHERE st.sprint_id = $1`,
    [sprintId],
  )

  const total = taskRows.reduce((s: number, r: any) => s + (r.story_points ?? 0), 0)
  const start = sprint.start_date ? new Date(sprint.start_date) : new Date()
  const end = sprint.end_date ? new Date(sprint.end_date) : new Date(start.getTime() + 14 * 86400000)

  const burndownData: Array<{ date: string; remaining: number; ideal: number }> = []
  let remaining = total
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000)
  const dailyIdeal = days > 0 ? total / days : 0

  for (let d = 0; d <= days; d++) {
    const date = new Date(start.getTime() + d * 86400000)
    const dateStr = date.toISOString().split('T')[0]!
    const completedOnDay = taskRows
      .filter((t: any) => t.completed_date === dateStr)
      .reduce((s: number, t: any) => s + (t.story_points ?? 0), 0)
    remaining -= completedOnDay
    burndownData.push({
      date: dateStr,
      remaining: Math.max(0, remaining),
      ideal: Math.round(Math.max(0, total - dailyIdeal * d)),
    })
  }

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
    },
    totalPoints: total,
    burndown: burndownData,
  }
}

// ============================================================
// Recent activity — last N task activities across workspace
// ============================================================

async function computeRecentActivity(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<unknown> {
  const limit = (config['limit'] as number | undefined) ?? 20
  const { rows } = await db.query(
    `SELECT ta.id, ta.task_id, ta.action, ta.actor_id, ta.changes, ta.created_at,
            t.title as task_title
     FROM task_activity ta
     JOIN tasks t ON t.id = ta.task_id
     JOIN lists l ON l.id = t.list_id
     JOIN spaces s ON s.id = l.space_id
     WHERE s.workspace_id = $1 AND t.deleted_at IS NULL
     ORDER BY ta.created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  )
  return { activities: rows }
}

// ============================================================
// Goals progress — all goals with their targets
// ============================================================

async function computeGoalsProgress(
  db: Pool,
  workspaceId: string,
): Promise<unknown> {
  const { rows } = await db.query(
    `SELECT g.id, g.name, g.color, g.due_date,
            COALESCE(array_agg(json_build_object(
              'id', gt.id, 'type', gt.type,
              'currentValue', gt.current_value,
              'targetValue', gt.target_value
            ) ORDER BY gt.created_at) FILTER (WHERE gt.id IS NOT NULL), '{}') as targets
     FROM goals g
     LEFT JOIN goal_targets gt ON gt.goal_id = g.id
     WHERE g.workspace_id = $1
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    [workspaceId],
  )
  return { goals: rows }
}

// ============================================================
// Cumulative flow — task counts grouped by status (snapshot)
// ============================================================

async function computeCumulativeFlow(
  db: Pool,
  config: Record<string, unknown>,
  workspaceId: string,
): Promise<unknown> {
  const listId = config['listId'] as string | undefined
  const { rows } = await db.query(
    `SELECT t.status, COUNT(*) as count
     FROM tasks t
     JOIN lists l ON l.id = t.list_id
     JOIN spaces s ON s.id = l.space_id
     WHERE s.workspace_id = $1 AND t.deleted_at IS NULL
     ${listId ? 'AND t.list_id = $2' : ''}
     GROUP BY t.status`,
    listId ? [workspaceId, listId] : [workspaceId],
  )
  return { statusCounts: rows, snapshotAt: new Date().toISOString() }
}

async function computeBurnup(
  db: Pool,
  config: Record<string, unknown>,
): Promise<unknown> {
  const sprintId = config['sprintId'] as string | undefined
  if (!sprintId) return { error: 'sprintId required in widget config' }

  const { rows: sprintRows } = await db.query(
    'SELECT * FROM sprints WHERE id = $1',
    [sprintId],
  )
  const sprint = sprintRows[0] as any
  if (!sprint) return { error: 'Sprint not found' }

  const { rows: taskRows } = await db.query(
    `SELECT t.story_points, t.completed_at::date as completed_date
     FROM sprint_tasks st
     JOIN tasks t ON t.id = st.task_id AND t.deleted_at IS NULL
     WHERE st.sprint_id = $1`,
    [sprintId],
  )

  const total = taskRows.reduce((s: number, r: any) => s + ((r as any).story_points ?? 0), 0)
  const start = sprint.start_date ? new Date(sprint.start_date as string) : new Date()
  const end = sprint.end_date ? new Date(sprint.end_date as string) : new Date(start.getTime() + 14 * 86400000)
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000)

  const burnup: Array<{ date: string; completed: number; scope: number }> = []
  let cumCompleted = 0

  for (let d = 0; d <= days; d++) {
    const date = new Date(start.getTime() + d * 86400000)
    const dateStr = date.toISOString().split('T')[0]!
    const completedOnDay = taskRows
      .filter((t: any) => (t as any).completed_date === dateStr)
      .reduce((s: number, t: any) => s + ((t as any).story_points ?? 0), 0)
    cumCompleted += completedOnDay
    burnup.push({ date: dateStr, completed: cumCompleted, scope: total })
  }

  return {
    sprint: { id: sprint.id, name: sprint.name },
    totalPoints: total,
    burnup,
  }
}
