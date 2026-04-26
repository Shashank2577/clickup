import { subscribe, logger } from '@clickup/sdk'
import {
  TASK_EVENTS,
  COMMENT_EVENTS,
  NOTIFICATION_EVENTS,
  TaskAssignedEvent,
  CommentCreatedEvent,
  CommentMentionedEvent,
  NotificationSendEvent,
  NotificationType,
} from '@clickup/contracts'
import { createNotificationRepository } from './notifications.repository.js'
import { EmailService } from '../email/email.service.js'
import type { Pool } from 'pg'

export async function startNotificationSubscribers(db: Pool): Promise<void> {
  const repository = createNotificationRepository(db)
  const emailService = new EmailService()

  await subscribe(
    TASK_EVENTS.ASSIGNED as any,
    async (payload: TaskAssignedEvent) => {
      if (!payload.assigneeId || payload.assigneeId === payload.assignedBy) {
        logger.debug({ payload }, 'task.assigned: skipping self-assignment or missing assignee')
        return
      }

      await repository.createNotification({
        userId: payload.assigneeId,
        type: NotificationType.TaskAssigned,
        payload: {
          taskId: payload.taskId,
          listId: payload.listId,
          workspaceId: payload.workspaceId,
          assignedBy: payload.assignedBy,
          taskTitle: '', // Would need task lookup
          assignedByName: '', // Would need user lookup
        },
      })

      logger.info(
        { taskId: payload.taskId, assigneeId: payload.assigneeId },
        'notification created: task_assigned',
      )
    },
    { durable: 'notif-svc-task-assigned' },
  )

  await subscribe(
    COMMENT_EVENTS.CREATED as any,
    async (payload: CommentCreatedEvent) => {
      if (!payload.mentionedUserIds || payload.mentionedUserIds.length === 0) {
        return
      }

      for (const userId of payload.mentionedUserIds) {
        if (userId === payload.userId) continue

        await repository.createNotification({
          userId,
          type: NotificationType.TaskMentioned,
          payload: {
            taskId: payload.taskId,
            commentId: payload.commentId,
            workspaceId: payload.workspaceId,
            mentionedBy: payload.userId,
            taskTitle: '',
            mentionedByName: '',
            context: payload.content.slice(0, 100),
          },
        })

        logger.info(
          { taskId: payload.taskId, mentionedUserId: userId },
          'notification created: task_mentioned',
        )
      }
    },
    { durable: 'notif-svc-comment-created' },
  )

  // Dedicated mention event — carries authorId, sends email via EmailService
  await subscribe(
    COMMENT_EVENTS.MENTIONED as any,
    async (payload: CommentMentionedEvent) => {
      if (!payload.mentionedUserIds || payload.mentionedUserIds.length === 0) return

      for (const userId of payload.mentionedUserIds) {
        if (userId === payload.authorId) continue

        // Send email — email address not available without user lookup, so we log placeholder
        // In production wire a user-service call here to resolve email address
        await emailService.sendMentionEmail(
          `${userId}@placeholder.local`,
          'A teammate',
          `Task ${payload.taskId}`,
          `https://app.clickup-oss.local/tasks/${payload.taskId}?comment=${payload.commentId}`,
        )

        logger.info(
          { commentId: payload.commentId, mentionedUserId: userId },
          'mention email dispatched',
        )
      }
    },
    { durable: 'notif-svc-comment-mentioned' },
  )

  // Automation-triggered notifications — published by automations-service
  await subscribe(
    NOTIFICATION_EVENTS.SEND as any,
    async (payload: NotificationSendEvent) => {
      await repository.createNotification({
        userId: payload.userId,
        type: payload.type as any,
        payload: payload.payload,
      })

      logger.info(
        { userId: payload.userId, type: payload.type },
        'notification created: automation triggered',
      )
    },
    { durable: 'notif-svc-notification-send' },
  )
}
