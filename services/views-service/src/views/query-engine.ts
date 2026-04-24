import { Pool } from 'pg'
import { AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// View Query Engine — executes view configs against tasks table
// All queries are parameterized to prevent SQL injection.
// ============================================================

export interface ViewConfig {
  filters?: Array<{
    field: string
    op: 'eq' | 'neq' | 'in' | 'nin' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'is_null'
    value?: unknown
  }>
  sort?: Array<{ field: string; dir: 'asc' | 'desc' }>
  groupBy?: string
  columns?: string[]
  dateField?: string
}

export interface ViewRow {
  id: string
  listId: string
  workspaceId: string
  name: string
  type: string
  config: ViewConfig
  createdBy: string
  isPrivate: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface QueryOptions {
  page?: number | undefined
  pageSize?: number | undefined
  groupByOverride?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

// Allowlisted filter/sort fields — never allow raw column names from user input
const ALLOWED_FILTER_FIELDS = new Set([
  'status',
  'priority',
  'assignee_id',
  'due_date',
  'start_date',
  'created_at',
  'updated_at',
  'list_id',
])

// Allowlisted group-by fields
const ALLOWED_GROUP_FIELDS = new Set([
  'status',
  'priority',
  'assignee_id',
  'list_id',
])

function validateField(field: string, allowed: Set<string>): string {
  if (!allowed.has(field)) {
    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, `Field '${field}' is not allowed`)
  }
  return field
}

function buildFilterClauses(
  filters: ViewConfig['filters'],
  params: unknown[],
): string[] {
  if (!filters || filters.length === 0) return []

  const clauses: string[] = []

  for (const f of filters) {
    const col = validateField(f.field, ALLOWED_FILTER_FIELDS)

    switch (f.op) {
      case 'eq': {
        params.push(f.value)
        clauses.push(`t.${col} = $${params.length}`)
        break
      }
      case 'neq': {
        params.push(f.value)
        clauses.push(`t.${col} != $${params.length}`)
        break
      }
      case 'in': {
        if (!Array.isArray(f.value) || f.value.length === 0) break
        const placeholders = f.value.map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        clauses.push(`t.${col} = ANY(ARRAY[${placeholders.join(', ')}])`)
        break
      }
      case 'nin': {
        if (!Array.isArray(f.value) || f.value.length === 0) break
        const placeholders = f.value.map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        clauses.push(`t.${col} != ALL(ARRAY[${placeholders.join(', ')}])`)
        break
      }
      case 'lt': {
        params.push(f.value)
        clauses.push(`t.${col} < $${params.length}`)
        break
      }
      case 'lte': {
        params.push(f.value)
        clauses.push(`t.${col} <= $${params.length}`)
        break
      }
      case 'gt': {
        params.push(f.value)
        clauses.push(`t.${col} > $${params.length}`)
        break
      }
      case 'gte': {
        params.push(f.value)
        clauses.push(`t.${col} >= $${params.length}`)
        break
      }
      case 'contains': {
        params.push(`%${String(f.value).replace(/[%_]/g, '\\$&')}%`)
        clauses.push(`t.${col}::text ILIKE $${params.length}`)
        break
      }
      case 'is_null': {
        clauses.push(`t.${col} IS NULL`)
        break
      }
    }
  }

  return clauses
}

function buildSortClause(sort: ViewConfig['sort']): string {
  if (!sort || sort.length === 0) return 'ORDER BY t.position ASC, t.created_at ASC'

  const parts = sort.map((s) => {
    const col = validateField(s.field, ALLOWED_FILTER_FIELDS)
    const dir = s.dir === 'desc' ? 'DESC' : 'ASC'
    return `t.${col} ${dir}`
  })

  return `ORDER BY ${parts.join(', ')}`
}

const TASK_SELECT = `
  t.id,
  t.list_id           AS "listId",
  t.parent_id         AS "parentId",
  t.title,
  t.description,
  t.status,
  t.priority,
  t.assignee_id       AS "assigneeId",
  t.due_date          AS "dueDate",
  t.start_date        AS "startDate",
  t.estimated_minutes AS "estimatedMinutes",
  t.actual_minutes    AS "actualMinutes",
  t.sprint_points     AS "sprintPoints",
  t.position,
  t.created_by        AS "createdBy",
  t.created_at        AS "createdAt",
  t.updated_at        AS "updatedAt",
  t.completed_at      AS "completedAt"
`

// ============================================================
// Main execution function
// ============================================================

export async function executeViewQuery(
  view: ViewRow,
  db: Pool,
  options: QueryOptions = {},
) {
  const config: ViewConfig = (view.config as ViewConfig) ?? {}
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  const params: unknown[] = []
  const whereClauses: string[] = ['t.deleted_at IS NULL']

  // Apply view config filters
  const filterClauses = buildFilterClauses(config.filters, params)
  whereClauses.push(...filterClauses)

  const sortClause = buildSortClause(config.sort)

  // Determine the effective groupBy field
  const groupByField = options.groupByOverride
    ? validateField(options.groupByOverride, ALLOWED_GROUP_FIELDS)
    : config.groupBy
      ? validateField(config.groupBy, ALLOWED_GROUP_FIELDS)
      : null

  switch (view.type) {
    case 'calendar': {
      const dateField = config.dateField === 'start_date' ? 'start_date' : 'due_date'
      if (options.from) {
        params.push(options.from)
        whereClauses.push(`t.${dateField} >= $${params.length}`)
      }
      if (options.to) {
        params.push(options.to)
        whereClauses.push(`t.${dateField} <= $${params.length}`)
      }
      break
    }

    case 'timeline': {
      // For timeline, we want tasks that have either start_date or due_date
      whereClauses.push(`(t.start_date IS NOT NULL OR t.due_date IS NOT NULL)`)
      break
    }

    case 'workload': {
      // Handled by dedicated workload function
      break
    }

    // list, board, table, gantt — just apply filters
    default:
      break
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`

  // Count query
  const countSQL = `SELECT COUNT(*) AS total FROM tasks t ${whereSQL}`
  const countResult = await db.query(countSQL, params)
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  // Data query — add pagination params
  params.push(pageSize)
  const limitParam = params.length
  params.push(offset)
  const offsetParam = params.length

  const dataSQL = `
    SELECT ${TASK_SELECT}
    FROM tasks t
    ${whereSQL}
    ${sortClause}
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `
  const dataResult = await db.query(dataSQL, params)
  const tasks = dataResult.rows

  // If groupBy, bucket results client-side (already fetched with limit)
  if (groupByField && (view.type === 'board' || view.type === 'table' || view.type === 'list')) {
    const groups: Record<string, typeof tasks> = {}
    for (const task of tasks) {
      const key = String(task[groupByField] ?? '__none__')
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
    return {
      grouped: true,
      groupBy: groupByField,
      groups,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  return {
    grouped: false,
    tasks,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

// ============================================================
// Workload view: tasks grouped by assignee with sprint_points
// and time_entries sum
// ============================================================

export async function executeWorkloadQuery(
  view: ViewRow,
  db: Pool,
  options: QueryOptions = {},
) {
  const config: ViewConfig = (view.config as ViewConfig) ?? {}
  const params: unknown[] = []
  const whereClauses: string[] = ['t.deleted_at IS NULL']

  const filterClauses = buildFilterClauses(config.filters, params)
  whereClauses.push(...filterClauses)

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`

  const sql = `
    SELECT
      t.assignee_id                              AS "assigneeId",
      COUNT(t.id)                                AS "taskCount",
      COALESCE(SUM(t.sprint_points), 0)          AS "totalSprintPoints",
      COALESCE(SUM(t.actual_minutes), 0)         AS "totalActualMinutes",
      COALESCE(SUM(t.estimated_minutes), 0)      AS "totalEstimatedMinutes",
      json_agg(
        json_build_object(
          'id',             t.id,
          'title',          t.title,
          'status',         t.status,
          'priority',       t.priority,
          'dueDate',        t.due_date,
          'sprintPoints',   t.sprint_points,
          'actualMinutes',  t.actual_minutes,
          'estimatedMinutes', t.estimated_minutes
        ) ORDER BY t.position ASC
      )                                          AS tasks
    FROM tasks t
    ${whereSQL}
    GROUP BY t.assignee_id
    ORDER BY "totalSprintPoints" DESC
  `

  const result = await db.query(sql, params)
  return {
    grouped: true,
    groupBy: 'assigneeId',
    assignees: result.rows,
  }
}
