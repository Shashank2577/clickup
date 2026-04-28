import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ErrorCode } from '@clickup/contracts'
import { AppError } from '../errors/AppError.js'

// ============================================================
// Auth context attached to every request after verification
// ============================================================

export interface AuthContext {
  userId: string
  workspaceId: string
  role: string
  sessionId: string
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext
    }
  }
}

// ============================================================
// JWT verification middleware
// Mount on any route that requires authentication
// ============================================================

export function injectGatewayAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined
  if (userId) {
    req.auth = {
      userId,
      workspaceId: (req.headers['x-workspace-id'] as string) ?? '',
      role: (req.headers['x-user-role'] as string) ?? 'member',
      sessionId: (req.headers['x-session-id'] as string) ?? '',
    }
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  // If auth was already set by gateway X-User header middleware, skip JWT verification
  if (req.auth && req.auth.userId) {
    next()
    return
  }

  const authHeader = req.headers.authorization

  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    console.error('[requireAuth] REJECTING - authHeader type:', typeof authHeader, 'isArray:', Array.isArray(authHeader), 'value:', JSON.stringify(authHeader))
    throw new AppError(ErrorCode.AUTH_MISSING_TOKEN)
  }

  const token = authHeader.slice(7)
  const secret = process.env['JWT_SECRET']

  if (secret === undefined) {
    throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'JWT_SECRET not configured')
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & AuthContext

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.workspaceId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.sessionId !== 'string'
    ) {
      throw new AppError(ErrorCode.AUTH_INVALID_TOKEN)
    }

    req.auth = {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      role: payload.role,
      sessionId: payload.sessionId,
    }

    next()
  } catch (err) {
    if (err instanceof AppError) {
      next(err)
      return
    }

    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError(ErrorCode.AUTH_EXPIRED_TOKEN))
      return
    }

    next(new AppError(ErrorCode.AUTH_INVALID_TOKEN))
  }
}

// ============================================================
// Role check middleware — use after requireAuth
// Usage: router.delete('/x', requireAuth, requireRole('admin'), handler)
// ============================================================

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!allowedRoles.includes(req.auth.role)) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
    }
    next()
  }
}

// ============================================================
// JWT token factory — used only by identity-service
// ============================================================

export function signToken(payload: AuthContext, expiresIn = '7d'): string {
  const secret = process.env['JWT_SECRET']
  if (secret === undefined) {
    throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'JWT_SECRET not configured')
  }
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}
