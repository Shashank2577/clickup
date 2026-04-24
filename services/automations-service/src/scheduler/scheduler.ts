import { Pool } from 'pg'
import { logger } from '@clickup/sdk'
import { AutomationEngine } from '../engine/engine.js'

export function startScheduler(db: Pool): void {
  const engine = new AutomationEngine(db)

  // Poll every 60 seconds
  setInterval(async () => {
    try {
      await runDueSchedules(db, engine)
    } catch (err) {
      logger.error({ err }, 'Scheduler run failed')
    }
  }, 60_000)

  // Also run immediately on startup (after 5s to let the service settle)
  setTimeout(async () => {
    try {
      await runDueSchedules(db, engine)
    } catch (err) {
      logger.error({ err }, 'Initial scheduler run failed')
    }
  }, 5_000)

  logger.info('Automation scheduler started (60s interval)')
}

async function runDueSchedules(db: Pool, engine: AutomationEngine): Promise<void> {
  // Find schedules due to run (next_run_at in the past or null) for enabled automations
  const { rows: dueSchedules } = await db.query(
    `SELECT s.*, a.workspace_id, a.id AS automation_id_check
     FROM automation_schedules s
     JOIN automations a ON a.id = s.automation_id AND a.is_enabled = true
     WHERE s.next_run_at IS NULL OR s.next_run_at <= NOW()`,
  )

  for (const schedule of dueSchedules) {
    try {
      // Run the automation with a scheduled trigger payload
      await engine.runScheduledAutomation(schedule.automation_id, schedule.workspace_id, {
        triggerType: 'scheduled',
        scheduleId: schedule.id,
        cronExpr: schedule.cron_expr,
        firedAt: new Date().toISOString(),
      })

      // Update last_run_at and compute next_run_at
      const nextRun = computeNextRun(schedule.cron_expr)
      await db.query(
        `UPDATE automation_schedules
         SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW()
         WHERE id = $2`,
        [nextRun, schedule.id],
      )
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id }, 'Schedule run failed')
    }
  }
}

/**
 * Compute the next Date at which the given 5-field cron expression should fire.
 *
 * Supported field syntax: '*' (wildcard) or a plain integer.
 * Fields: minute  hour  day-of-month  month  day-of-week
 *
 * Strategy: advance minute-by-minute from (now + 1 min) up to 7 days ahead
 * and return the first candidate that satisfies all non-wildcard fields.
 * Falls back to 24 hours from now if nothing matches within 7 days.
 */
export function computeNextRun(cronExpr: string): Date {
  const parts = cronExpr.split(' ')
  const [minField, hourField, domField, monField, dowField] = parts

  const matches = (field: string | undefined, value: number): boolean => {
    if (!field || field === '*') return true
    const num = parseInt(field, 10)
    return !isNaN(num) && num === value
  }

  // Start from the next whole minute
  const now = new Date()
  const candidate = new Date(now.getTime() + 60_000)
  candidate.setSeconds(0, 0)

  // Try up to 7 days (10 080 minutes)
  for (let i = 0; i < 10_080; i++) {
    if (i > 0) {
      candidate.setMinutes(candidate.getMinutes() + 1)
    }

    if (
      matches(minField, candidate.getMinutes()) &&
      matches(hourField, candidate.getHours()) &&
      matches(domField, candidate.getDate()) &&
      matches(monField, candidate.getMonth() + 1) &&
      matches(dowField, candidate.getDay())
    ) {
      return new Date(candidate.getTime())
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * 3600 * 1000)
}
