import { ErrorCode, ERROR_STATUS_MAP } from '@clickup/contracts'

// ============================================================
// AppError — the ONLY error class agents throw
// Never throw raw Error objects in service code.
// Usage: throw new AppError(ErrorCode.TASK_NOT_FOUND)
// ============================================================

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly status: number
  public readonly details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS_MAP[code]
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }

  public toResponse(traceId: string): object {
    return {
      error: {
        code: this.code,
        message: this.message,
        status: this.status,
        traceId,
        ...(this.details !== undefined && { details: this.details }),
      },
    }
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
