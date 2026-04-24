import { Request, Response } from 'express'
import { asyncHandler } from '@clickup/sdk'
import { Pool } from 'pg'

export function backlogHandler(db: Pool) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { listId } = req.params
    const page = parseInt(req.query['page'] as string || '1', 10)
    const pageSize = Math.min(parseInt(req.query['pageSize'] as string || '50', 10), 100)
    const offset = (page - 1) * pageSize

    // Tasks in this list NOT in any active sprint
    const { rows } = await db.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.position,
              t.story_points, t.created_at
       FROM tasks t
       WHERE t.list_id = $1
         AND t.deleted_at IS NULL
         AND t.status != 'archived'
         AND t.id NOT IN (
           SELECT st.task_id
           FROM sprint_tasks st
           JOIN sprints sp ON sp.id = st.sprint_id
           WHERE sp.list_id = $1
             AND sp.status = 'active'
         )
       ORDER BY t.position ASC
       LIMIT $2 OFFSET $3`,
      [listId, pageSize, offset],
    )

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total
       FROM tasks t
       WHERE t.list_id = $1
         AND t.deleted_at IS NULL
         AND t.status != 'archived'
         AND t.id NOT IN (
           SELECT st.task_id FROM sprint_tasks st
           JOIN sprints sp ON sp.id = st.sprint_id
           WHERE sp.list_id = $1 AND sp.status = 'active'
         )`,
      [listId],
    )

    res.json({
      data: rows,
      meta: { total: parseInt(countRows[0]!.total, 10), page, pageSize },
    })
  })
}
