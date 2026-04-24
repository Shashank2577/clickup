import { subscribe, logger } from '@clickup/sdk'
import {
  TASK_EVENTS,
  COMMENT_EVENTS,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  CommentCreatedEvent,
  CommentDeletedEvent,
} from '@clickup/contracts'
import { Client } from '@elastic/elasticsearch'
import { INDEX } from './elastic.client.js'

export async function startSearchIndexers(elastic: Client): Promise<void> {

  await subscribe(
    TASK_EVENTS.CREATED as any,
    async (payload: TaskCreatedEvent) => {
      await elastic.index({
        index: INDEX,
        id:    payload.taskId,
        document: {
          id:          payload.taskId,
          type:        'task',
          workspaceId: payload.workspaceId,
          listId:      payload.listId,
          title:       payload.title,
          description: '',
          status:      null,
          priority:    null,
          assigneeId:  payload.assigneeId || null,
          createdBy:   payload.createdBy,
          createdAt:   payload.occurredAt,
          updatedAt:   payload.occurredAt,
          tags:        [],
        },
      })
      logger.info({ taskId: payload.taskId }, 'search: indexed task.created')
    },
    { durable: 'search-svc-task-created' }
  )

  await subscribe(
    TASK_EVENTS.UPDATED as any,
    async (payload: TaskUpdatedEvent) => {
      await elastic.update({
        index: INDEX,
        id:    payload.taskId,
        doc: {
          ...payload.changes,
          updatedAt: payload.occurredAt,
        },
      })
      logger.info({ taskId: payload.taskId }, 'search: updated task.updated')
    },
    { durable: 'search-svc-task-updated' }
  )

  await subscribe(
    TASK_EVENTS.DELETED as any,
    async (payload: TaskDeletedEvent) => {
      try {
        await elastic.delete({
          index: INDEX,
          id:    payload.taskId,
        })
        logger.info({ taskId: payload.taskId }, 'search: removed task.deleted')
      } catch (err: any) {
        const status = err.meta?.statusCode
        if (status !== 404) throw err
        logger.debug({ taskId: payload.taskId }, 'search: task.deleted — doc not found, skipping')
      }
    },
    { durable: 'search-svc-task-deleted' }
  )

  // Index comments so they appear in search results
  await subscribe(
    COMMENT_EVENTS.CREATED as any,
    async (payload: CommentCreatedEvent) => {
      await elastic.index({
        index: INDEX,
        id:    payload.commentId,
        document: {
          id:          payload.commentId,
          type:        'comment',
          workspaceId: payload.workspaceId,
          listId:      null,
          title:       payload.content.slice(0, 200),
          description: payload.content,
          status:      null,
          priority:    null,
          assigneeId:  null,
          createdBy:   payload.userId,
          createdAt:   payload.occurredAt,
          updatedAt:   payload.occurredAt,
          tags:        [],
        },
      })
      logger.info({ commentId: payload.commentId }, 'search: indexed comment.created')
    },
    { durable: 'search-svc-comment-created' }
  )

  await subscribe(
    COMMENT_EVENTS.DELETED as any,
    async (payload: CommentDeletedEvent) => {
      try {
        await elastic.delete({
          index: INDEX,
          id:    payload.commentId,
        })
        logger.info({ commentId: payload.commentId }, 'search: removed comment.deleted')
      } catch (err: any) {
        const status = err.meta?.statusCode
        if (status !== 404) throw err
        logger.debug({ commentId: payload.commentId }, 'search: comment.deleted — doc not found, skipping')
      }
    },
    { durable: 'search-svc-comment-deleted' }
  )
}
