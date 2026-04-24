import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { logger } from '@clickup/sdk'
import { AutomationsRepository } from '../automations/automations.repository.js'
import { evaluateConditions } from './evaluator.js'
import { executeAction } from './executor.js'

export class AutomationEngine {
  private repository: AutomationsRepository

  constructor(db: Pool) {
    this.repository = new AutomationsRepository(db)
  }

  async runAutomations(triggerEvent: string, payload: Record<string, unknown>): Promise<void> {
    const triggerTypeMap: Record<string, string> = {
      'task.created':        'task_created',
      'task.updated':        'task_field_changed',
      'task.status_changed': 'task_status_changed',
      'task.assigned':       'task_assigned',
      'task.completed':      'task_status_changed',
      'comment.created':     'comment_created',
      'sprint.started':      'sprint_started',
      'sprint.completed':    'sprint_completed',
    }

    const triggerType = triggerTypeMap[triggerEvent]
    if (!triggerType) return

    const workspaceId = payload['workspaceId'] as string
    if (!workspaceId) {
      logger.warn({ triggerEvent }, 'Event missing workspaceId')
      return
    }

    const automations = await this.repository.findEnabledByTrigger(workspaceId, triggerType)

    for (const automation of automations) {
      const runId = randomUUID()
      const startedAt = new Date()
      let conditionsMet = false
      const actionsTaken: any[] = []
      let runError: string | null = null

      try {
        const triggerMatches = this.matchesTriggerConfig(triggerEvent, automation.trigger_config, payload)
        if (!triggerMatches) continue

        conditionsMet = evaluateConditions(automation.conditions, payload)

        if (conditionsMet) {
          for (const action of automation.actions) {
            try {
              await executeAction(action, payload, workspaceId)
              actionsTaken.push({ type: action.type, config: action.config, success: true })
            } catch (err: any) {
              actionsTaken.push({ type: action.type, config: action.config, success: false, error: err.message })
              logger.error({ err, automationId: automation.id }, 'Action failed')
            }
          }
          await this.repository.incrementRunCount(automation.id)
        }
      } catch (err: any) {
        runError = err.message
        logger.error({ err, automationId: automation.id }, 'Automation run failed')
      } finally {
        await this.repository.recordRun({
          id: runId,
          automationId: automation.id,
          workspaceId,
          triggerEvent,
          triggerPayload: payload,
          conditionsMet,
          actionsTaken,
          error: runError,
          startedAt,
          completedAt: new Date(),
        })
      }
    }
  }

  async runScheduledAutomation(
    automationId: string,
    workspaceId: string,
    triggerPayload: Record<string, unknown>,
  ): Promise<void> {
    const automation = await this.repository.findById(automationId)
    if (!automation || !automation.is_enabled) return

    const runId = randomUUID()
    const startedAt = new Date()
    const actionsTaken: any[] = []
    let runError: string | null = null

    try {
      const conditionsMet = evaluateConditions(automation.conditions, triggerPayload)

      if (conditionsMet) {
        for (const action of automation.actions) {
          try {
            await executeAction(action, triggerPayload, workspaceId)
            actionsTaken.push({ type: action.type, success: true })
          } catch (err: any) {
            actionsTaken.push({ type: action.type, success: false, error: err.message })
            logger.error({ err, automationId }, 'Scheduled action failed')
          }
        }
        await this.repository.incrementRunCount(automationId)
      }
    } catch (err: any) {
      runError = err.message
      logger.error({ err, automationId }, 'Scheduled automation failed')
    } finally {
      await this.repository.recordRun({
        id: runId,
        automationId,
        workspaceId,
        triggerEvent: 'scheduled',
        triggerPayload,
        conditionsMet: true,
        actionsTaken,
        error: runError,
        startedAt,
        completedAt: new Date(),
      })
    }
  }

  private matchesTriggerConfig(event: string, config: any, payload: any): boolean {
    if (event === 'task.created' && config?.listId) {
      return payload.listId === config.listId
    }
    if (event === 'task.status_changed') {
      if (config?.fromStatus && payload.oldStatus !== config.fromStatus) return false
      if (config?.toStatus && payload.newStatus !== config.toStatus) return false
    }
    return true
  }
}
