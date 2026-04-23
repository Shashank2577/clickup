import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateListStatusSchema, UpdateListStatusSchema } from '@clickup/contracts'

function toStatusDto(row: any) {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    color: row.color,
    position: row.position,
    isClosed: row.is_closed,
    createdAt: row.created_at,
  }
}

// Mounted at /lists/:listId/statuses (mergeParams: true)
export function statusesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /lists/:listId/statuses
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { listId } = req.params as { listId: string }
    const { rows } = await db.query(
      'SELECT * FROM list_statuses WHERE list_id = $1 ORDER BY position ASC',
      [listId],
    )
    res.json({ data: rows.map(toStatusDto) })
  }))

  // POST /lists/:listId/statuses
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { listId } = req.params as { listId: string }
    const input = validate(CreateListStatusSchema, req.body)

    // Verify list exists
    const { rows: listRows } = await db.query('SELECT id FROM lists WHERE id = $1', [listId])
    if (!listRows.length) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    // Get next position
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM list_statuses WHERE list_id = $1',
      [listId],
    )
    const position = input.position ?? posRows[0].next

    try {
      const { rows } = await db.query(
        'INSERT INTO list_statuses (list_id, name, color, position, is_closed) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [listId, input.name, input.color, position, input.isClosed],
      )
      res.status(201).json({ data: toStatusDto(rows[0]) })
    } catch (err: any) {
      if (err.code === '23505') throw new AppError(ErrorCode.LIST_STATUS_ALREADY_EXISTS)
      throw err
    }
  }))

  // PATCH /lists/:listId/statuses/:statusId
  router.patch('/:statusId', requireAuth, asyncHandler(async (req, res) => {
    const { listId, statusId } = req.params as { listId: string; statusId: string }
    const { rows: existing } = await db.query(
      'SELECT * FROM list_statuses WHERE id = $1 AND list_id = $2',
      [statusId, listId],
    )
    if (!existing.length) throw new AppError(ErrorCode.LIST_STATUS_NOT_FOUND)

    const input = validate(UpdateListStatusSchema, req.body)
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates['name'] = input.name
    if (input.color !== undefined) updates['color'] = input.color
    if (input.isClosed !== undefined) updates['is_closed'] = input.isClosed
    if (input.position !== undefined) updates['position'] = input.position

    const fields = Object.keys(updates)
    if (!fields.length) { res.json({ data: toStatusDto(existing[0]) }); return }

    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
    const { rows } = await db.query(
      `UPDATE list_statuses SET ${setClause} WHERE id = $1 AND list_id = $2 RETURNING *`,
      [statusId, listId, ...Object.values(updates)],
    )
    res.json({ data: toStatusDto(rows[0]) })
  }))

  // DELETE /lists/:listId/statuses/:statusId
  router.delete('/:statusId', requireAuth, asyncHandler(async (req, res) => {
    const { listId, statusId } = req.params as { listId: string; statusId: string }
    const { rowCount } = await db.query(
      'DELETE FROM list_statuses WHERE id = $1 AND list_id = $2',
      [statusId, listId],
    )
    if (!rowCount) throw new AppError(ErrorCode.LIST_STATUS_NOT_FOUND)
    res.status(204).end()
  }))

  return router
}
