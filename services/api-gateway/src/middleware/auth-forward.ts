import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '@clickup/sdk'
import { AppError } from '@clickup/sdk'

/**
 * Verify JWT from Authorization header and forward decoded claims
 * to upstream services via X-User-* headers.
 *
 * Public routes (e.g. /api/v1/auth/login, /api/v1/auth/register, /health)
 * skip verification — they are listed in PUBLIC_PREFIXES.
 */
const PUBLIC_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/health',
]

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function authForward(req: Request, _res: Response, next: NextFunction): void {
  if (isPublic(req.path)) {
    next()
    return
  }

  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header'))
    return
  }

  const token = header.slice(7)
  const claims = verifyToken(token)
  if (!claims) {
    next(new AppError('UNAUTHORIZED', 'Invalid or expired token'))
    return
  }

  // Forward claims to upstream services
  req.headers['x-user-id'] = claims.sub
  req.headers['x-user-email'] = claims.email
  req.headers['x-user-role'] = claims.role
  if (claims.workspaceId) {
    req.headers['x-workspace-id'] = claims.workspaceId
  }

  next()
}
