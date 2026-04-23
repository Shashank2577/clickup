import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'

// ============================================================
// Minimal multipart body reader — no new dependencies
// Reads a multipart/form-data body with a CSV file part and fields.
// Returns { fields: Record<string, string>, file?: string }
// ============================================================

interface MultipartResult {
  fields: Record<string, string>
  file?: string
  filename?: string
}

async function readMultipart(req: Request): Promise<MultipartResult> {
  const contentType = req.headers['content-type'] ?? ''
  const boundaryMatch = /boundary=([^\s;]+)/.exec(contentType)
  if (!boundaryMatch) {
    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Expected multipart/form-data with boundary')
  }
  const boundary = '--' + boundaryMatch[1]!

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', resolve)
    req.on('error', reject)
  })

  const body = Buffer.concat(chunks).toString('latin1')
  const parts = body.split(boundary).slice(1) // skip preamble

  const fields: Record<string, string> = {}
  let file: string | undefined
  let filename: string | undefined

  for (const part of parts) {
    if (part.trim() === '--' || part.trim() === '--\r\n') break
    const [headerSection, ...contentParts] = part.split('\r\n\r\n')
    const content = contentParts.join('\r\n\r\n').replace(/\r\n--$/, '')
    const nameMatch = /name="([^"]+)"/.exec(headerSection ?? '')
    const filenameMatch = /filename="([^"]+)"/.exec(headerSection ?? '')
    if (!nameMatch) continue
    const fieldName = nameMatch[1]!
    if (filenameMatch) {
      filename = filenameMatch[1]!
      file = content
    } else {
      fields[fieldName] = content.trim()
    }
  }

  const result: { fields: Record<string, string>; file?: string; filename?: string } = { fields }
  if (file !== undefined) result["file"] = file
  if (filename !== undefined) result["filename"] = filename
  return result
}

// ============================================================
// Simple CSV parser — no dependencies
// Handles quoted fields and escaped quotes.
// ============================================================

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]!)
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!)
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++ // skip opening quote
      let value = ''
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          value += line[i]!
          i++
        }
      }
      fields.push(value)
      if (line[i] === ',') i++ // skip comma
    } else {
      // Unquoted field
      const end = line.indexOf(',', i)
      if (end === -1) {
        fields.push(line.slice(i))
        break
      }
      fields.push(line.slice(i, end))
      i = end + 1
    }
  }
  return fields
}

// ============================================================
// CSV serialiser helper
// ============================================================

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function rowToCsvLine(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',')
}

// ============================================================
// Handler factory
// ============================================================

export function importExportRouter(db: Pool): Router {
  const router = Router()
  const repository = new TasksRepository(db)

  // ── CSV Import ──────────────────────────────────────────────────────────────
  // POST /import/csv
  // Accepts multipart/form-data: CSV file + listId field
  router.post(
    '/import/csv',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      // Parse multipart manually (no papaparse / formidable needed)
      const { fields, file } = await readMultipart(req)

      const listId = fields['listId']
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId field is required')
      if (!file) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'CSV file is required')

      // Verify list exists and get workspace context
      const meta = await repository.getListMetadata(listId)
      if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

      // Verify membership
      const memberResult = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [meta.workspace_id, req.auth!.userId],
      )
      if (!memberResult.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const { rows } = parseCsv(file)

      let imported = 0
      const errors: { row: number; message: string }[] = []

      const basePath = '/' + listId + '/'

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const rowNum = i + 2 // 1-indexed, +1 for header row

        const title = row['title']?.trim()
        if (!title) {
          errors.push({ row: rowNum, message: 'title is required' })
          continue
        }

        try {
          const taskId = randomUUID()
          const path = basePath + taskId + '/'

          // Map priority to valid values
          const rawPriority = row['priority']?.toLowerCase()
          const priority = ['urgent', 'high', 'normal', 'low', 'none'].includes(rawPriority ?? '')
            ? rawPriority
            : 'none'

          // Map status
          const status = row['status']?.trim() || 'todo'

          const assigneeId = row['assignee_id']?.trim() || undefined
          const createArgs: Parameters<typeof repository.createTask>[0] = {
            id: taskId,
            listId,
            title,
            parentId: null,
            path,
            createdBy: req.auth!.userId,
            priority: priority as any,
          }
          if (assigneeId) createArgs.assigneeId = assigneeId
          await repository.createTask(createArgs)

          // Set description via update if provided
          if (row['description']?.trim()) {
            await repository.updateTask(taskId, { description: row['description'].trim() })
          }

          // Set status if provided
          if (status && status !== 'todo') {
            await repository.updateTask(taskId, { status })
          }

          // Set due_date if provided
          if (row['due_date']?.trim()) {
            await repository.updateTask(taskId, { due_date: row['due_date'].trim() })
          }

          // Set tags if provided
          if (row['tags']?.trim()) {
            const tags = row['tags'].split(',').map((t) => t.trim()).filter(Boolean)
            for (const tag of tags) {
              await repository.addTag(taskId, tag)
            }
          }

          imported++
        } catch (err: any) {
          errors.push({ row: rowNum, message: err?.message ?? 'unknown error' })
        }
      }

      res.json({ imported, errors })
    }),
  )

  // ── CSV Export ──────────────────────────────────────────────────────────────
  // GET /export/csv?listId=uuid
  router.get(
    '/export/csv',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const listId = req.query['listId'] as string | undefined
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId query param is required')

      const meta = await repository.getListMetadata(listId)
      if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

      const memberResult = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [meta.workspace_id, req.auth!.userId],
      )
      if (!memberResult.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      // Fetch all non-deleted tasks in list
      const taskRows = await db.query<{
        id: string
        title: string
        description: string | null
        status: string
        priority: string
        assignee_id: string | null
        due_date: string | null
        created_at: Date
      }>(
        `SELECT id, title, description, status, priority, assignee_id, due_date, created_at
         FROM tasks
         WHERE list_id = $1 AND deleted_at IS NULL
         ORDER BY position ASC`,
        [listId],
      )

      const CSV_HEADERS = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date', 'created_at', 'tags']

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv')

      // Write header row
      res.write(CSV_HEADERS.join(',') + '\n')

      // Write data rows
      for (const task of taskRows.rows) {
        // Get tags for task
        const tagRows = await repository.getTags(task.id)
        const tagsStr = tagRows.join(',')

        const line = rowToCsvLine([
          task.title,
          task.description ?? '',
          task.status,
          task.priority,
          task.assignee_id ?? '',
          task.due_date ?? '',
          task.created_at.toISOString(),
          tagsStr,
        ])
        res.write(line + '\n')
      }

      res.end()
    }),
  )

  // ── JSON Export ─────────────────────────────────────────────────────────────
  // GET /export/json?listId=uuid
  router.get(
    '/export/json',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const listId = req.query['listId'] as string | undefined
      if (!listId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId query param is required')

      const meta = await repository.getListMetadata(listId)
      if (!meta) throw new AppError(ErrorCode.LIST_NOT_FOUND)

      const memberResult = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [meta.workspace_id, req.auth!.userId],
      )
      if (!memberResult.rows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      // Full task data
      const taskRows = await db.query(
        `SELECT t.*, array_agg(tt.tag) FILTER (WHERE tt.tag IS NOT NULL) AS tags
         FROM tasks t
         LEFT JOIN task_tags tt ON tt.task_id = t.id
         WHERE t.list_id = $1 AND t.deleted_at IS NULL
         GROUP BY t.id
         ORDER BY t.position ASC`,
        [listId],
      )

      res.json({ data: taskRows.rows })
    }),
  )

  return router
}
