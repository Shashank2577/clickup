import { z, type ZodTypeAny } from 'zod'
import { AppError } from '@clickup/sdk'

const validators: Record<string, ZodTypeAny> = {
  task: z.object({
    id: z.string().uuid(),
    listId: z.string().uuid(),
    title: z.string(),
    priority: z.string(),
    createdBy: z.string().uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string(),
  }),
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    ownerId: z.string().uuid(),
  }),
  workspaceMember: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.string(),
    joinedAt: z.string(),
  }),
  space: z.object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    name: z.string(),
  }),
  list: z.object({
    id: z.string().uuid(),
    spaceId: z.string().uuid(),
    name: z.string(),
  }),
  comment: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    body: z.string(),
    authorId: z.string().uuid(),
  }),
  notification: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    type: z.string(),
    isRead: z.boolean(),
  }),
}

export function validateResponse(entityType: string, data: unknown): boolean {
  const validator = validators[entityType]
  if (!validator) {
    throw new AppError('VALIDATION_INVALID_INPUT', `No validator registered for entity type: "${entityType}"`)

  }
  const result = validator.safeParse(data)
  if (!result.success) {
    throw new AppError(
      'VALIDATION_INVALID_INPUT',
      `Contract violation for "${entityType}":\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    )
  }
  return true
}

export function validatePaginatedResponse(
  entityType: string,
  data: unknown,
): boolean {
  const itemValidator = validators[entityType]
  if (!itemValidator) {
    throw new AppError('VALIDATION_INVALID_INPUT', `No validator registered for entity type: "${entityType}"`)

  }
  const schema = z.object({
    items: z.array(itemValidator),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new AppError(
      'VALIDATION_INVALID_INPUT',
      `Paginated contract violation for "${entityType}":\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    )
  }
  return true
}
