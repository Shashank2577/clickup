import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../db.js'
import { clerkAuth } from './clerk-auth.js'

const PUBLIC_PREFIXES = [
  '/v1/auth/webhooks',   // Clerk webhook — verified by svix, not Clerk session
  '/v1/forms/submit/',
  '/v1/tasks/share/',
  '/v1/docs/shared/',
  '/health',
]

const INTERNAL_HEADERS = ['x-user-id', 'x-user-role', 'x-org-id', 'x-workspace-id', 'x-session-id', 'x-api-key-id', 'x-api-key-scopes']

function isPublic(path: string, method: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || path.endsWith('/health')) {
    return true
  }
  return false
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function validateApiKey(raw: string): Promise<{
  userId: string
  workspaceId: string
  scopes: string[]
  keyId: string
} | null> {
  const hash = createHash('sha256').update(raw).digest('hex')
  const { rows } = await db.query<{
    id: string
    user_id: string
    workspace_id: string
    scopes: string[]
  }>(
    `SELECT id, user_id, workspace_id, scopes
     FROM api_keys
     WHERE key_hash = $1
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [hash],
  )
  if (!rows[0]) return null
  db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {})
  return {
    keyId: rows[0].id,
    userId: rows[0].user_id,
    workspaceId: rows[0].workspace_id,
    scopes: rows[0].scopes ?? [],
  }
}

export function authForward(req: Request, res: Response, next: NextFunction): void {
  for (const header of INTERNAL_HEADERS) {
    delete req.headers[header]
  }

  const path = req.originalUrl || req.url
  if (isPublic(path, req.method)) {
    next()
    return
  }

  const token = extractBearerToken(req)

  // ── API key path (cu_ prefix) ──────────────────────────────────────────────
  if (token?.startsWith('cu_')) {
    validateApiKey(token)
      .then((info) => {
        if (!info) {
          res.status(401).json({ error: 'API key invalid or expired' })
          return
        }
        req.headers['x-user-id']        = info.userId
        req.headers['x-workspace-id']   = info.workspaceId
        req.headers['x-api-key-id']     = info.keyId
        req.headers['x-api-key-scopes'] = info.scopes.join(',')
        req.headers['x-user-role']      = 'member'
        next()
      })
      .catch((err) => next(err))
    return
  }

  // ── Clerk session path ─────────────────────────────────────────────────────
  clerkAuth(req, res, next).catch(next)
}
