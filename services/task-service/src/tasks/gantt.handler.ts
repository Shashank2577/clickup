import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// Mounted at /gantt (no mergeParams needed — standalone prefix)
export function ganttRouter(db: Pool): Router {
  const router = Router()

  // GET /gantt?workspaceId=&listIds=id1,id2&startDate=2024-01-01&endDate=2024-03-31
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).auth!.userId as string

      const workspaceId = req.query['workspaceId'] as string | undefined
      const listIdsRaw = req.query['listIds'] as string | undefined
      const startDateRaw = req.query['startDate'] as string | undefined
      const endDateRaw = req.query['endDate'] as string | undefined

      if (!workspaceId) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param is required')
      }
      if (!listIdsRaw) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listIds query param is required')
      }
      if (!startDateRaw) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'startDate query param is required')
      }
      if (!endDateRaw) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'endDate query param is required')
      }

      const listIds = listIdsRaw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

      if (listIds.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listIds must contain at least one list ID')
      }

      // Verify workspace membership
      const memberResult = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId],
      )
      if (!memberResult.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      // Verify that the requested lists belong to the given workspace
      const listCheckResult = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM lists l
         JOIN spaces s ON s.id = l.space_id
         WHERE l.id = ANY($1::uuid[]) AND s.workspace_id = $2`,
        [listIds, workspaceId],
      )
      const listCount = parseInt(listCheckResult.rows[0]?.count ?? '0', 10)
      if (listCount !== listIds.length) {
        throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED, 'One or more lists do not belong to this workspace')
      }

      const { rows: tasks } = await db.query(
        `SELECT
           t.id, t.title, t.status, t.priority,
           t.start_date, t.due_date, t.position,
           t.list_id, t.parent_id AS parent_task_id,
           array_agg(
             json_build_object('taskId', tr.related_task_id, 'type', tr.relation_type)
             ORDER BY tr.created_at
           ) FILTER (WHERE tr.id IS NOT NULL) AS dependencies
         FROM tasks t
         LEFT JOIN task_relations tr
           ON tr.task_id = t.id
           AND tr.relation_type IN ('blocks', 'blocked_by')
         WHERE t.deleted_at IS NULL
           AND t.list_id = ANY($1::uuid[])
           AND (
             (t.start_date IS NOT NULL AND t.start_date BETWEEN $2 AND $3)
             OR (t.due_date IS NOT NULL AND t.due_date BETWEEN $2 AND $3)
           )
         GROUP BY t.id
         ORDER BY t.start_date ASC NULLS LAST, t.due_date ASC NULLS LAST`,
        [listIds, startDateRaw, endDateRaw],
      )

      res.json({
        data: {
          tasks,
          dateRange: {
            start: startDateRaw,
            end: endDateRaw,
          },
        },
      })
    }),
  )

  return router
}
