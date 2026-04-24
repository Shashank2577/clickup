import { Pool } from 'pg'
import { Automation, AutomationTriggerType } from '@clickup/contracts'

export class AutomationsRepository {
  constructor(private readonly db: Pool) {}

  async createAutomation(record: {
    workspaceId: string
    name: string
    triggerType: string
    triggerConfig: any
    conditions: any[]
    actions: any[]
    createdBy: string
  }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO automations (workspace_id, name, trigger_type, trigger_config, conditions, actions, created_by) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [record.workspaceId, record.name, record.triggerType, record.triggerConfig, JSON.stringify(record.conditions), JSON.stringify(record.actions), record.createdBy]
    )
    return rows[0]
  }

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM automations WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    )
    return rows
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.db.query('SELECT * FROM automations WHERE id = $1', [id])
    return rows[0] || null
  }

  async updateAutomation(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates)
    if (fields.length === 0) return this.findById(id)

    const setClause = fields.map((f, i) => f + ' = $' + (i + 2)).join(', ')
    const values = fields.map(f => {
      if (typeof updates[f] === 'object' && updates[f] !== null) return JSON.stringify(updates[f])
      return updates[f]
    })
    const query = 'UPDATE automations SET ' + setClause + ', updated_at = NOW() WHERE id = $1 RETURNING *'
    
    const { rows } = await this.db.query(query, [id, ...values])
    return rows[0]
  }

  async deleteAutomation(id: string): Promise<void> {
    await this.db.query('DELETE FROM automations WHERE id = $1', [id])
  }

  async findEnabledByTrigger(workspaceId: string, triggerType: string): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM automations WHERE workspace_id = $1 AND trigger_type = $2 AND is_enabled = TRUE',
      [workspaceId, triggerType]
    )
    return rows
  }

  async incrementRunCount(id: string): Promise<void> {
    await this.db.query('UPDATE automations SET run_count = run_count + 1 WHERE id = $1', [id])
  }

  async recordRun(run: any): Promise<void> {
    await this.db.query(
      'INSERT INTO automation_runs (id, automation_id, workspace_id, trigger_event, trigger_payload, conditions_met, actions_taken, error, started_at, completed_at) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [run.id, run.automationId, run.workspaceId, run.triggerEvent, JSON.stringify(run.triggerPayload), run.conditionsMet, JSON.stringify(run.actionsTaken), run.error, run.startedAt, run.completedAt]
    )
  }

  async listRuns(automationId: string, limit: number, offset: number): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM automation_runs WHERE automation_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3',
      [automationId, limit, offset]
    )
    return rows
  }

  async countRuns(automationId: string): Promise<number> {
    const { rows } = await this.db.query('SELECT COUNT(*) FROM automation_runs WHERE automation_id = $1', [automationId])
    return parseInt(rows[0].count, 10)
  }

  // ── Schedule CRUD ────────────────────────────────────────────────────────────

  async createSchedule(automationId: string, cronExpr: string, timezone: string): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO automation_schedules (automation_id, cron_expr, timezone)
       VALUES ($1, $2, $3) RETURNING *`,
      [automationId, cronExpr, timezone],
    )
    return rows[0]
  }

  async listSchedules(automationId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM automation_schedules WHERE automation_id = $1 ORDER BY created_at`,
      [automationId],
    )
    return rows
  }

  async updateSchedule(
    scheduleId: string,
    updates: { cronExpr?: string; timezone?: string },
  ): Promise<any> {
    const sets: string[] = []
    const params: unknown[] = [scheduleId]
    let idx = 2
    if (updates.cronExpr !== undefined) {
      sets.push(`cron_expr = $${idx++}`)
      params.push(updates.cronExpr)
    }
    if (updates.timezone !== undefined) {
      sets.push(`timezone = $${idx++}`)
      params.push(updates.timezone)
    }
    // Always reset next_run_at so the scheduler re-evaluates
    sets.push(`next_run_at = NULL`)
    sets.push(`updated_at = NOW()`)
    const { rows } = await this.db.query(
      `UPDATE automation_schedules SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    )
    return rows[0]
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.db.query('DELETE FROM automation_schedules WHERE id = $1', [scheduleId])
  }
}

export const createAutomationsRepository = (db: Pool) => new AutomationsRepository(db)
