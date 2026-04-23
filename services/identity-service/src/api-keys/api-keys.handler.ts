import { Router } from 'express'
import type { Pool } from 'pg'
import { createHash, randomUUID } from 'crypto'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateApiKeySchema, UpdateApiKeySchema } from '@clickup/contracts'

interface ApiKeyRow {
  id: string
  workspace_id: string
  user_id: string
  name: string
  key_hash: string
  key_prefix: string
  scopes: string[]
  last_used_at: Date | null
  expires_at: Date | null
  created_at: Date
}

function toApiKeyDto(row: ApiKeyRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }
}

// Mounted at: /workspaces/:workspaceId/api-keys
export function apiKeysRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/api-keys — list (no key_hash in response)
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const r = await db.query<ApiKeyRow>(
        `SELECT id, workspace_id, user_id, name, key_hash, key_prefix, scopes,
                last_used_at, expires_at, created_at
         FROM api_keys
         WHERE workspace_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [workspaceId, req.auth.userId],
      )
      res.json({ data: r.rows.map(toApiKeyDto) })
    }),
  )

  // POST /workspaces/:workspaceId/api-keys — create (returns full key once)
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const input = validate(CreateApiKeySchema, req.body)

      // Generate key: cu_ + 32 hex chars (from UUID without dashes)
      const raw = 'cu_' + randomUUID().replace(/-/g, '')
      const keyPrefix = raw.slice(0, 10)
      const keyHash = createHash('sha256').update(raw).digest('hex')

      const r = await db.query<ApiKeyRow>(
        `INSERT INTO api_keys (workspace_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, workspace_id, user_id, name, key_hash, key_prefix, scopes,
                   last_used_at, expires_at, created_at`,
        [
          workspaceId,
          req.auth.userId,
          input.name,
          keyHash,
          keyPrefix,
          input.scopes,
          input.expiresAt ?? null,
        ],
      )
      const keyRecord = toApiKeyDto(r.rows[0]!)
      res.status(201).json({ data: { ...keyRecord, key: raw } })
    }),
  )

  // PATCH /workspaces/:workspaceId/api-keys/:id — update name only
  router.patch(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId, id } = req.params
      if (!workspaceId || !id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const input = validate(UpdateApiKeySchema, req.body)

      if (input.name === undefined) {
        throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'name is required')
      }

      const r = await db.query<ApiKeyRow>(
        `UPDATE api_keys SET name = $1
         WHERE id = $2 AND user_id = $3 AND workspace_id = $4
         RETURNING id, workspace_id, user_id, name, key_hash, key_prefix, scopes,
                   last_used_at, expires_at, created_at`,
        [input.name, id, req.auth.userId, workspaceId],
      )
      if (r.rowCount === 0) throw new AppError(ErrorCode.API_KEY_NOT_FOUND)
      res.json({ data: toApiKeyDto(r.rows[0]!) })
    }),
  )

  // DELETE /workspaces/:workspaceId/api-keys/:id
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId, id } = req.params
      if (!workspaceId || !id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required')

      const memberR = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      if (!memberR.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const r = await db.query(
        `DELETE FROM api_keys WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
        [id, req.auth.userId, workspaceId],
      )
      if (r.rowCount === 0) throw new AppError(ErrorCode.API_KEY_NOT_FOUND)
      res.status(204).end()
    }),
  )

  return router
}
