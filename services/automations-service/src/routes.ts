import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import {
  createAutomationHandler,
  listAutomationsHandler,
  getAutomationHandler,
  updateAutomationHandler,
  deleteAutomationHandler,
  listRunsHandler
} from './automations/automations.handler.js'
import { automationTemplatesRouter } from './automations/templates.handler.js'
import { AutomationsRepository } from './automations/automations.repository.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  // Base prefix /api/v1/automations is stripped by the Gateway

  // Templates — MUST be before /:automationId to avoid wildcard matching
  router.use('/templates', automationTemplatesRouter(db))

  router.post('/', requireAuth, createAutomationHandler(db))
  router.get('/workspace/:workspaceId', requireAuth, listAutomationsHandler(db))
  router.get('/:automationId', requireAuth, getAutomationHandler(db))
  router.patch('/:automationId', requireAuth, updateAutomationHandler(db))
  router.delete('/:automationId', requireAuth, deleteAutomationHandler(db))
  router.get('/:automationId/runs', requireAuth, listRunsHandler(db))

  // ── Schedule CRUD — /:automationId/schedules ─────────────────────────────────

  router.get('/:automationId/schedules', requireAuth, asyncHandler(async (req, res) => {
    const { automationId } = req.params
    const automation = await db.query('SELECT * FROM automations WHERE id = $1', [automationId])
    if (!automation.rows[0]) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)
    const repo = new AutomationsRepository(db)
    const schedules = await repo.listSchedules(automationId!)
    res.json({ data: schedules })
  }))

  router.post('/:automationId/schedules', requireAuth, asyncHandler(async (req, res) => {
    const { automationId } = req.params
    const { cronExpr, timezone = 'UTC' } = req.body
    if (!cronExpr) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'cronExpr is required')
    if (cronExpr.split(' ').length !== 5) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'cronExpr must be 5 fields')
    }
    const repo = new AutomationsRepository(db)
    const schedule = await repo.createSchedule(automationId!, cronExpr, timezone)
    res.status(201).json({ data: schedule })
  }))

  router.patch('/:automationId/schedules/:scheduleId', requireAuth, asyncHandler(async (req, res) => {
    const { scheduleId } = req.params
    const repo = new AutomationsRepository(db)
    const updated = await repo.updateSchedule(scheduleId!, {
      cronExpr: req.body.cronExpr,
      timezone: req.body.timezone,
    })
    if (!updated) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)
    res.json({ data: updated })
  }))

  router.delete('/:automationId/schedules/:scheduleId', requireAuth, asyncHandler(async (req, res) => {
    const { scheduleId } = req.params
    const repo = new AutomationsRepository(db)
    await repo.deleteSchedule(scheduleId!)
    res.status(204).send()
  }))

  return router
}
