import { createServiceClient, publish, logger } from '@clickup/sdk'
import { AutomationActionType, NOTIFICATION_EVENTS } from '@clickup/contracts'
import type { AutomationAction, NotificationSendEvent } from '@clickup/contracts'

export async function executeAction(
  action: AutomationAction,
  payload: Record<string, unknown>,
  workspaceId: string
): Promise<void> {
  const taskId     = payload['taskId'] as string | undefined
  const taskClient = createServiceClient(
    process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002'
  ) as any

  switch (action.type) {
    case AutomationActionType.ChangeStatus:
      if (!taskId) throw new Error('change_status action requires taskId in event payload')
      await taskClient.patch('/api/v1/tasks/' + taskId, {
        status: action.config['status'],
      })
      break

    case AutomationActionType.AssignUser:
      if (!taskId) throw new Error('assign_user action requires taskId in event payload')
      await taskClient.patch('/api/v1/tasks/' + taskId, {
        assigneeId: action.config['userId'],
      })
      break

    case AutomationActionType.CreateTask: {
      const listId = action.config['listId'] as string
      if (!listId) throw new Error('create_task action requires listId in action config')
      await taskClient.post('/api/v1/tasks', {
        listId,
        title:    action.config['title'] ?? 'Automated Task',
        priority: action.config['priority'] ?? 'none',
      })
      break
    }

    case AutomationActionType.SendNotification: {
      const userId = action.config['userId'] as string
      if (!userId) throw new Error('send_notification action requires userId in action config')
      await publish(NOTIFICATION_EVENTS.SEND as any, {
        userId,
        type: 'automation_triggered',
        payload: {
          taskId,
          workspaceId,
          message: action.config['message'] ?? 'An automation triggered a notification',
        },
        occurredAt: new Date().toISOString(),
      } as NotificationSendEvent)
      break
    }

    case AutomationActionType.AddComment: {
      if (!taskId) throw new Error('add_comment action requires taskId in event payload')
      await taskClient.post('/api/v1/tasks/' + taskId + '/comments', {
        content: action.config['content'] ?? 'This task was updated by an automation.',
      })
      break
    }

    case AutomationActionType.Webhook: {
      const url = action.config['url'] as string
      if (!url) throw new Error('webhook action requires url in action config')
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: payload, workspaceId }),
      })
      if (!response.ok) {
        throw new Error('Webhook returned ' + response.status + ': ' + response.statusText)
      }
      break
    }

    case AutomationActionType.UpdateField:
      if (!taskId) throw new Error('update_field action requires taskId in event payload')
      await taskClient.patch('/api/v1/tasks/' + taskId, action.config)
      break

    default:
      logger.warn({ actionType: action.type }, 'Unknown or unhandled action type — skipping')
  }
}
