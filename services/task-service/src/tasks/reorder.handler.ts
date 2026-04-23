import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

// Mounted at /lists (handles /lists/:listId/tasks/reorder and /lists/:listId/statuses/reorder)
export function reorderRouter(db: Pool): Router {
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

  // PATCH /lists/:listId/tasks/reorder
  router.patch('/:listId/tasks/reorder', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { listId } = req.params as { listId: string }
    const { taskIds } = req.body as { taskIds: string[] }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'taskIds must be a non-empty array')
    }

    const meta = await repository.getListMetadata(listId)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    // Build CASE ... END expression for bulk position update
    const caseLines = taskIds.map((id, i) => `WHEN id = '${id.replace(/'/g, "''")}' THEN ${i}.0`).join(' ')
    const idPlaceholders = taskIds.map((_, i) => '$' + (i + 2)).join(', ')

    await db.query(
      `UPDATE tasks
       SET position = CASE ${caseLines} END,
           updated_at = NOW(),
           version = version + 1
       WHERE list_id = $1 AND id = ANY(ARRAY[${idPlaceholders}]::uuid[]) AND deleted_at IS NULL`,
      [listId, ...taskIds],
    )

    res.json({ data: { reordered: taskIds.length } })
  }))

  // PATCH /lists/:listId/statuses/reorder
  router.patch('/:listId/statuses/reorder', requireAuth, asyncHandler(async (req, res): Promise<void> => {
    const { listId } = req.params as { listId: string }
    const { statusIds } = req.body as { statusIds: string[] }

    if (!Array.isArray(statusIds) || statusIds.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'statusIds must be a non-empty array')
    }

    const meta = await repository.getListMetadata(listId)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)
    await verifyMembership(meta.workspace_id, req.auth.userId)

    const caseLines = statusIds.map((id, i) => `WHEN id = '${id.replace(/'/g, "''")}' THEN ${i}`).join(' ')
    const idPlaceholders = statusIds.map((_, i) => '$' + (i + 2)).join(', ')

    await db.query(
      `UPDATE list_statuses
       SET position = CASE ${caseLines} END
       WHERE list_id = $1 AND id = ANY(ARRAY[${idPlaceholders}]::uuid[])`,
      [listId, ...statusIds],
    )

    res.json({ data: { reordered: statusIds.length } })
  }))

  return router
}
