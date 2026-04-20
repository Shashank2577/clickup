import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '@clickup/sdk'

/**
 * Strip client-supplied X-User-* headers to prevent header injection, then
 * verify JWT and forward decoded claims to upstream services.
 *
 * Public routes skip JWT verification but X-User-* headers are always stripped
 * so upstream services can trust that any X-User-* header came from the gateway.
 */
const PUBLIC_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
]

const INTERNAL_HEADERS = ['x-user-id', 'x-user-role', 'x-workspace-id', 'x-session-id']

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function authForward(req: Request, res: Response, next: NextFunction): void {
  // Always strip client-supplied internal headers (prevents header injection)
  for (const header of INTERNAL_HEADERS) {
    delete req.headers[header]
  }

  if (isPublic(req.baseUrl + req.path)) {
    next()
    return
  }

  // requireAuth verifies JWT, sets req.auth, and calls next(AppError) on failure
  requireAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err)
      return
    }
    // Forward verified claims to upstream services
    req.headers['x-user-id'] = req.auth.userId
    req.headers['x-user-role'] = req.auth.role
    req.headers['x-workspace-id'] = req.auth.workspaceId
    req.headers['x-session-id'] = req.auth.sessionId
    next()
  })
}
