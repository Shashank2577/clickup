import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

// Mounted at /:taskId/mirrors (mergeParams: true)
export function mirrorsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })
  const repository = new TasksRepository(db)

  // Helper: verify workspace membership via the task's list
  async function verifyMembership(taskId: string, userId: string): Promise<void> {
    const task = await repository.getTask(taskId)
    if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

    const meta = await repository.getListMetadata(task.list_id)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    const memberResult = await db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [meta.workspace_id, userId],
    )
    if (!memberResult.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  }

  // POST /:taskId/mirrors — add task to another list
  // Body: { listId: string }
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params as { taskId: string }
      const userId = (req as any).auth!.userId as string

      await verifyMembership(taskId, userId)

      const mirroredListId = req.body?.listId
      if (!mirroredListId || typeof mirroredListId !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId is required')
      }

      // Verify the target list exists
      const targetMeta = await repository.getListMetadata(mirroredListId)
      if (!targetMeta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

      try {
        const { rows } = await db.query<{
          id: string
          original_task_id: string
          mirrored_list_id: string
          position: number
          created_by: string
          created_at: Date
        }>(
          `INSERT INTO task_mirrors (original_task_id, mirrored_list_id, created_by)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [taskId, mirroredListId, userId],
        )

        res.status(201).json({ data: rows[0] })
      } catch (err: any) {
        if (err.code === '23505') {
          // UNIQUE constraint: mirror already exists
          throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Task is already mirrored in that list')
        }
        throw err
      }
    }),
  )

  // GET /:taskId/mirrors — list all mirror locations
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params as { taskId: string }
      const userId = (req as any).auth!.userId as string

      await verifyMembership(taskId, userId)

      const { rows } = await db.query<{
        id: string
        original_task_id: string
        mirrored_list_id: string
        list_name: string
        position: number
        created_by: string
        created_at: Date
      }>(
        `SELECT tm.id, tm.original_task_id, tm.mirrored_list_id,
                l.name AS list_name,
                tm.position, tm.created_by, tm.created_at
         FROM task_mirrors tm
         JOIN lists l ON l.id = tm.mirrored_list_id
         WHERE tm.original_task_id = $1
         ORDER BY tm.created_at ASC`,
        [taskId],
      )

      res.json({ data: rows })
    }),
  )

  // DELETE /:taskId/mirrors/:mirrorId — remove from a list
  router.delete(
    '/:mirrorId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId, mirrorId } = req.params as { taskId: string; mirrorId: string }
      const userId = (req as any).auth!.userId as string

      await verifyMembership(taskId, userId)

      await db.query(
        `DELETE FROM task_mirrors WHERE id = $1`,
        [mirrorId],
      )

      res.status(204).end()
    }),
  )

  return router
}
