import type { ZodSchema } from 'zod'
import { ZodError } from 'zod'
import { ErrorCode } from '@clickup/contracts'
import { AppError } from '../errors/AppError.js'

// ============================================================
// Validate input against a Zod schema from @clickup/contracts
// Throws AppError with VALIDATION_INVALID_INPUT on failure.
// Usage: const input = validate(CreateTaskSchema, req.body)
// ============================================================

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    const details = formatZodErrors(result.error)
    throw new AppError(
      ErrorCode.VALIDATION_INVALID_INPUT,
      'Validation failed',
      { fields: details },
    )
  }

  return result.data
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    if (fields[path] === undefined) {
      fields[path] = []
    }
    fields[path].push(issue.message)
  }

  return fields
}
