import { Router } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'
import { logActivity } from './activity.handler.js'

// Mounted at /:taskId/merge (mergeParams: true)
export function mergeRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new TasksRepository(db)

  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  async function verifyMembership(workspaceId: string, userId: string) {
    const client = createServiceClient(identityUrl, {}) as any
    try {
      const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId)
      const member = response.data?.data || response.data
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }
  }

  // POST /:taskId/merge
  router.post('/', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { taskId } = req.params as { taskId: string }
    const { sourceTaskId } = req.body as { sourceTaskId: string }

    if (!sourceTaskId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'sourceTaskId is required')
    }
    if (sourceTaskId === taskId) {
      throw new AppError(ErrorCode.TASK_SELF_RELATION, 'Cannot merge a task into itself')
    }

    // Load both tasks
    const target = await repository.getTask(taskId)
    if (!target) throw new AppError(ErrorCode.TASK_NOT_FOUND, 'Target task not found')

    const source = await repository.getTask(sourceTaskId)
    if (!source) throw new AppError(ErrorCode.TASK_NOT_FOUND, 'Source task not found')

    // Verify same workspace membership for both
    const targetMeta = await repository.getListMetadata(target.list_id)
    if (!targetMeta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    const sourceMeta = await repository.getListMetadata(source.list_id)
    if (!sourceMeta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    if (targetMeta.workspace_id !== sourceMeta.workspace_id) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED, 'Tasks must belong to the same workspace')
    }

    await verifyMembership(targetMeta.workspace_id, req.auth.userId)

    // Use a transaction for atomicity
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // 1. Append source description to target description
      const separator = '\n\n--- Merged from ' + source.title + ' ---\n\n'
      const newDescription = (target.description || '') + separator + (source.description || '')
      await client.query(
        'UPDATE tasks SET description = $1, updated_at = NOW(), version = version + 1 WHERE id = $2',
        [newDescription, taskId],
      )

      // 2. Move task_tags from source to target
      await client.query(
        'INSERT INTO task_tags (task_id, tag) SELECT $1, tag FROM task_tags WHERE task_id = $2 ON CONFLICT DO NOTHING',
        [taskId, sourceTaskId],
      )

      // 3. Move task_watchers from source to target
      await client.query(
        'INSERT INTO task_watchers (task_id, user_id) SELECT $1, user_id FROM task_watchers WHERE task_id = $2 ON CONFLICT DO NOTHING',
        [taskId, sourceTaskId],
      )

      // 4. Move task_relations — re-point from source to target
      await client.query(
        'UPDATE task_relations SET task_id = $1 WHERE task_id = $2',
        [taskId, sourceTaskId],
      )
      await client.query(
        'UPDATE task_relations SET related_task_id = $1 WHERE related_task_id = $2',
        [taskId, sourceTaskId],
      )

      // 5. Move comments
      await client.query(
        'UPDATE comments SET task_id = $1 WHERE task_id = $2',
        [taskId, sourceTaskId],
      )

      // 6. Move time_entries
      await client.query(
        'UPDATE time_entries SET task_id = $1 WHERE task_id = $2',
        [taskId, sourceTaskId],
      )

      // 7. Move checklists (which cascades to checklist_items)
      await client.query(
        'UPDATE checklists SET task_id = $1 WHERE task_id = $2',
        [taskId, sourceTaskId],
      )

      // 8. Archive source task
      await client.query(
        "UPDATE tasks SET status = 'merged', deleted_at = NOW() WHERE id = $1",
        [sourceTaskId],
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Log activity on target
    await logActivity(db, {
      taskId,
      userId: req.auth.userId,
      action: 'merge',
      field: 'merged_from',
      newValue: { sourceTaskId, sourceTitle: source.title },
    })

    // Return the updated target task
    const merged = await repository.getTask(taskId)
    res.json({ data: merged })
  }))

  return router
}
