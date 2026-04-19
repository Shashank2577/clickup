import type { Request, Response, NextFunction } from 'express'
import { ErrorCode } from '@clickup/contracts'
import { AppError, isAppError } from './AppError.js'
import { logger } from '../logging/logger.js'

// ============================================================
// Global Express error handler — mount as LAST middleware
// Ensures all errors return the standard AppErrorResponse shape
// ============================================================

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const traceId = (req.headers['x-trace-id'] as string | undefined) ?? 'unknown'

  if (isAppError(err)) {
    // Known application errors — log at warn level
    logger.warn({ code: err.code, traceId, path: req.path }, err.message)
    res.status(err.status).json(err.toResponse(traceId))
    return
  }

  // Unknown errors — log full stack, return generic 500
  logger.error({ err, traceId, path: req.path }, 'Unhandled error')

  const systemError = new AppError(
    ErrorCode.SYSTEM_INTERNAL_ERROR,
    'An unexpected error occurred',
  )
  res.status(500).json(systemError.toResponse(traceId))
}

// ============================================================
// Async route handler wrapper — prevents unhandled promise rejections
// Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
// ============================================================

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next)
  }
}
