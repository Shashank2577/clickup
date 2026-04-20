import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

// ============================================================
// Correlation ID middleware
// Ensures every request has a trace ID for log correlation.
// Mount before all routes and after httpLogger.
// ============================================================

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const traceId =
    (req.headers['x-trace-id'] as string | undefined) ?? randomUUID()

  req.headers['x-trace-id'] = traceId
  res.setHeader('x-trace-id', traceId)
  next()
}
