import { Request, Response } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { asyncHandler, AppError, createServiceClient } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

async function verifyMembership(workspaceId: string, userId: string) {
  const client = createServiceClient(identityUrl, {}) as any
  try {
    const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId)
    const member = response.data?.data || response.data
    if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  }
}

// POST /quick — lightweight task creation with minimal input
// Mounted as a single handler (not a router), requireAuth applied externally
export function quickCreateHandler(db: Pool) {
  const repository = new TasksRepository(db)

  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title, listId, assigneeId, dueDate, priority } = req.body as {
      title: string
      listId: string
      assigneeId?: string
      dueDate?: string
      priority?: string
    }

    if (!title || !title.trim()) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'title is required')
    }
    if (!listId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'listId is required')
    }

    // Verify list exists and user has workspace access
    const meta = await repository.getListMetadata(listId)
    if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    await verifyMembership(meta.workspace_id, req.auth.userId)

    const id = randomUUID()
    const path = '/' + listId + '/' + id + '/'

    const insertFields = ['id', 'list_id', 'path', 'title', 'created_by', 'version']
    const insertValues: unknown[] = [id, listId, path, title.trim(), req.auth.userId, 0]

    if (assigneeId) {
      insertFields.push('assignee_id')
      insertValues.push(assigneeId)
    }

    if (dueDate) {
      const parsed = new Date(dueDate)
      if (isNaN(parsed.getTime())) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_DATE, 'Invalid dueDate format')
      }
      insertFields.push('due_date')
      insertValues.push(parsed)
    }

    const validPriorities = ['urgent', 'high', 'normal', 'low', 'none']
    if (priority) {
      if (!validPriorities.includes(priority)) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'priority must be one of: ' + validPriorities.join(', '))
      }
      insertFields.push('priority')
      insertValues.push(priority)
    }

    const placeholders = insertValues.map((_, i) => '$' + (i + 1)).join(', ')
    const { rows } = await db.query(
      'INSERT INTO tasks (' + insertFields.join(', ') + ') VALUES (' + placeholders + ') RETURNING *',
      insertValues,
    )

    res.status(201).json({ data: rows[0] })
  })
}
