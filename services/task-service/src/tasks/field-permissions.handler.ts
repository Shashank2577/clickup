import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID } from 'crypto'

function toPermissionDto(row: any) {
  return {
    id: row.id,
    fieldId: row.field_id,
    role: row.role,
    canRead: row.can_read,
    canWrite: row.can_write,
    createdAt: row.created_at,
  }
}

export function fieldPermissionsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /custom-fields/:fieldId/permissions — list permissions for a field
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { fieldId } = req.params as { fieldId: string }

    // Verify field exists
    const { rows: fieldRows } = await db.query(
      'SELECT id FROM custom_fields WHERE id = $1',
      [fieldId],
    )
    if (!fieldRows[0]) throw new AppError(ErrorCode.CUSTOM_FIELD_NOT_FOUND)

    const { rows } = await db.query(
      'SELECT * FROM field_permissions WHERE field_id = $1 ORDER BY role ASC',
      [fieldId],
    )
    res.json({ data: rows.map(toPermissionDto) })
  }))

  // POST /custom-fields/:fieldId/permissions — set permissions
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { fieldId } = req.params as { fieldId: string }
    const { role, canRead, canWrite } = req.body as {
      role: string
      canRead: boolean
      canWrite: boolean
    }

    if (!role || typeof role !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'role is required')
    }
    if (typeof canRead !== 'boolean' || typeof canWrite !== 'boolean') {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'canRead and canWrite must be booleans')
    }

    // Verify field exists
    const { rows: fieldRows } = await db.query(
      'SELECT id FROM custom_fields WHERE id = $1',
      [fieldId],
    )
    if (!fieldRows[0]) throw new AppError(ErrorCode.CUSTOM_FIELD_NOT_FOUND)

    const permId = randomUUID()

    // Upsert: if a permission for this field+role already exists, update it
    const { rows } = await db.query(
      `INSERT INTO field_permissions (id, field_id, role, can_read, can_write)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (field_id, role) DO UPDATE SET can_read = $4, can_write = $5
       RETURNING *`,
      [permId, fieldId, role, canRead, canWrite],
    )

    res.status(201).json({ data: toPermissionDto(rows[0]) })
  }))

  // DELETE /custom-fields/:fieldId/permissions/:permId — remove permission
  router.delete('/:permId', requireAuth, asyncHandler(async (req, res) => {
    const { fieldId, permId } = req.params as { fieldId: string; permId: string }

    const { rowCount } = await db.query(
      'DELETE FROM field_permissions WHERE id = $1 AND field_id = $2',
      [permId, fieldId],
    )
    if (!rowCount) throw new AppError(ErrorCode.FIELD_PERMISSION_NOT_FOUND)
    res.status(204).end()
  }))

  return router
}
