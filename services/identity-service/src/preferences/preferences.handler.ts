import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, UpdateUserPreferencesSchema, UpdateWorkspaceClickAppsSchema } from '@clickup/contracts'

// DTO helpers — snake_case → camelCase

function toPreferencesDto(row: {
  user_id: string
  theme: string
  language: string
  timezone: string
  date_format: string
  time_format: string
  first_day_of_week: number
  sidebar_collapsed: boolean
  density: string
  extra: Record<string, unknown>
  updated_at: Date
}) {
  return {
    userId: row.user_id,
    theme: row.theme,
    language: row.language,
    timezone: row.timezone,
    dateFormat: row.date_format,
    timeFormat: row.time_format,
    firstDayOfWeek: row.first_day_of_week,
    sidebarCollapsed: row.sidebar_collapsed,
    density: row.density,
    extra: row.extra,
    updatedAt: row.updated_at.toISOString(),
  }
}

function defaultPreferences(userId: string) {
  return {
    userId,
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MMM D, YYYY',
    timeFormat: '12h',
    firstDayOfWeek: 0,
    sidebarCollapsed: false,
    density: 'comfortable',
    extra: {},
    updatedAt: new Date().toISOString(),
  }
}

function toClickAppsDto(row: {
  workspace_id: string
  sprints_enabled: boolean
  time_tracking_enabled: boolean
  priorities_enabled: boolean
  tags_enabled: boolean
  custom_fields_enabled: boolean
  automations_enabled: boolean
  goals_enabled: boolean
  ai_enabled: boolean
  milestones_enabled: boolean
  mind_maps_enabled: boolean
  whiteboards_enabled: boolean
  portfolios_enabled: boolean
  updated_at: Date
}) {
  return {
    workspaceId: row.workspace_id,
    sprintsEnabled: row.sprints_enabled,
    timeTrackingEnabled: row.time_tracking_enabled,
    prioritiesEnabled: row.priorities_enabled,
    tagsEnabled: row.tags_enabled,
    customFieldsEnabled: row.custom_fields_enabled,
    automationsEnabled: row.automations_enabled,
    goalsEnabled: row.goals_enabled,
    aiEnabled: row.ai_enabled,
    milestonesEnabled: row.milestones_enabled,
    mindMapsEnabled: row.mind_maps_enabled,
    whiteboardsEnabled: row.whiteboards_enabled,
    portfoliosEnabled: row.portfolios_enabled,
    updatedAt: row.updated_at.toISOString(),
  }
}

function defaultClickApps(workspaceId: string) {
  return {
    workspaceId,
    sprintsEnabled: true,
    timeTrackingEnabled: true,
    prioritiesEnabled: true,
    tagsEnabled: true,
    customFieldsEnabled: true,
    automationsEnabled: true,
    goalsEnabled: true,
    aiEnabled: true,
    milestonesEnabled: false,
    mindMapsEnabled: false,
    whiteboardsEnabled: false,
    portfoliosEnabled: false,
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================
// User Preferences Router
// Mounted at: /users/preferences
// ============================================================

export function userPreferencesRouter(db: Pool): Router {
  const router = Router()

  // GET /users/preferences — get current user's preferences
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const r = await db.query(
        `SELECT user_id, theme, language, timezone, date_format, time_format,
                first_day_of_week, sidebar_collapsed, density, extra, updated_at
         FROM user_preferences WHERE user_id = $1`,
        [req.auth.userId],
      )
      const row = r.rows[0]
      if (!row) {
        res.json({ data: defaultPreferences(req.auth.userId) })
        return
      }
      res.json({ data: toPreferencesDto(row) })
    }),
  )

  // PUT /users/preferences — upsert user preferences
  router.put(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(UpdateUserPreferencesSchema, req.body)

      // Build dynamic SET clause for provided fields
      const setClauses: string[] = ['updated_at = NOW()']
      const values: unknown[] = [req.auth.userId]
      let idx = 2

      if (input.theme !== undefined) { setClauses.push(`theme = $${idx++}`); values.push(input.theme) }
      if (input.language !== undefined) { setClauses.push(`language = $${idx++}`); values.push(input.language) }
      if (input.timezone !== undefined) { setClauses.push(`timezone = $${idx++}`); values.push(input.timezone) }
      if (input.dateFormat !== undefined) { setClauses.push(`date_format = $${idx++}`); values.push(input.dateFormat) }
      if (input.timeFormat !== undefined) { setClauses.push(`time_format = $${idx++}`); values.push(input.timeFormat) }
      if (input.firstDayOfWeek !== undefined) { setClauses.push(`first_day_of_week = $${idx++}`); values.push(input.firstDayOfWeek) }
      if (input.sidebarCollapsed !== undefined) { setClauses.push(`sidebar_collapsed = $${idx++}`); values.push(input.sidebarCollapsed) }
      if (input.density !== undefined) { setClauses.push(`density = $${idx++}`); values.push(input.density) }
      if (input.extra !== undefined) { setClauses.push(`extra = $${idx++}`); values.push(JSON.stringify(input.extra)) }

      const r = await db.query(
        `INSERT INTO user_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}
         RETURNING user_id, theme, language, timezone, date_format, time_format,
                   first_day_of_week, sidebar_collapsed, density, extra, updated_at`,
        values,
      )
      res.json({ data: toPreferencesDto(r.rows[0]) })
    }),
  )

  return router
}

// ============================================================
// Workspace ClickApps Router
// Mounted at: /workspaces/:workspaceId/clickapps
// ============================================================

export function workspaceClickAppsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/clickapps
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      // Verify workspace membership
      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const r = await db.query(
        `SELECT workspace_id, sprints_enabled, time_tracking_enabled, priorities_enabled,
                tags_enabled, custom_fields_enabled, automations_enabled, goals_enabled,
                ai_enabled, milestones_enabled, mind_maps_enabled, whiteboards_enabled,
                portfolios_enabled, updated_at
         FROM workspace_clickapps WHERE workspace_id = $1`,
        [workspaceId],
      )
      if (!r.rows[0]) {
        res.json({ data: defaultClickApps(workspaceId) })
        return
      }
      res.json({ data: toClickAppsDto(r.rows[0]) })
    }),
  )

  // PUT /workspaces/:workspaceId/clickapps
  router.put(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      // Verify admin or owner
      const memberR = await db.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      const member = memberR.rows[0]
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const input = validate(UpdateWorkspaceClickAppsSchema, req.body)

      const setClauses: string[] = ['updated_at = NOW()']
      const values: unknown[] = [workspaceId]
      let idx = 2

      if (input.sprintsEnabled !== undefined) { setClauses.push(`sprints_enabled = $${idx++}`); values.push(input.sprintsEnabled) }
      if (input.timeTrackingEnabled !== undefined) { setClauses.push(`time_tracking_enabled = $${idx++}`); values.push(input.timeTrackingEnabled) }
      if (input.prioritiesEnabled !== undefined) { setClauses.push(`priorities_enabled = $${idx++}`); values.push(input.prioritiesEnabled) }
      if (input.tagsEnabled !== undefined) { setClauses.push(`tags_enabled = $${idx++}`); values.push(input.tagsEnabled) }
      if (input.customFieldsEnabled !== undefined) { setClauses.push(`custom_fields_enabled = $${idx++}`); values.push(input.customFieldsEnabled) }
      if (input.automationsEnabled !== undefined) { setClauses.push(`automations_enabled = $${idx++}`); values.push(input.automationsEnabled) }
      if (input.goalsEnabled !== undefined) { setClauses.push(`goals_enabled = $${idx++}`); values.push(input.goalsEnabled) }
      if (input.aiEnabled !== undefined) { setClauses.push(`ai_enabled = $${idx++}`); values.push(input.aiEnabled) }
      if (input.milestonesEnabled !== undefined) { setClauses.push(`milestones_enabled = $${idx++}`); values.push(input.milestonesEnabled) }
      if (input.mindMapsEnabled !== undefined) { setClauses.push(`mind_maps_enabled = $${idx++}`); values.push(input.mindMapsEnabled) }
      if (input.whiteboardsEnabled !== undefined) { setClauses.push(`whiteboards_enabled = $${idx++}`); values.push(input.whiteboardsEnabled) }
      if (input.portfoliosEnabled !== undefined) { setClauses.push(`portfolios_enabled = $${idx++}`); values.push(input.portfoliosEnabled) }

      const r = await db.query(
        `INSERT INTO workspace_clickapps (workspace_id)
         VALUES ($1)
         ON CONFLICT (workspace_id) DO UPDATE SET ${setClauses.join(', ')}
         RETURNING workspace_id, sprints_enabled, time_tracking_enabled, priorities_enabled,
                   tags_enabled, custom_fields_enabled, automations_enabled, goals_enabled,
                   ai_enabled, milestones_enabled, mind_maps_enabled, whiteboards_enabled,
                   portfolios_enabled, updated_at`,
        values,
      )
      res.json({ data: toClickAppsDto(r.rows[0]) })
    }),
  )

  return router
}
