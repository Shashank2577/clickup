import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateTaskFormSchema, UpdateTaskFormSchema, SubmitFormSchema } from '@clickup/contracts'
import { randomUUID } from 'crypto'

function toFormDto(row: any) {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    description: row.description,
    fields: row.fields,
    isActive: row.is_active,
    slug: row.slug,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Math.random().toString(36).slice(2, 7)
}

// Mounted at /lists/:listId/forms (mergeParams: true)
export function formsRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /lists/:listId/forms
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { listId } = req.params as { listId: string }
    const { rows } = await db.query(
      'SELECT * FROM task_forms WHERE list_id = $1 ORDER BY created_at DESC',
      [listId],
    )
    res.json({ data: rows.map(toFormDto) })
  }))

  // POST /lists/:listId/forms — create form
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { listId } = req.params as { listId: string }
    const input = validate(CreateTaskFormSchema, req.body)
    const slug = input.slug ?? generateSlug(input.name)

    try {
      const { rows } = await db.query(
        'INSERT INTO task_forms (list_id, name, description, fields, slug, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [listId, input.name, input.description ?? null, JSON.stringify(input.fields), slug, req.auth.userId],
      )
      res.status(201).json({ data: toFormDto(rows[0]) })
    } catch (err: any) {
      if (err.code === '23505') throw new AppError(ErrorCode.TASK_FORM_SLUG_TAKEN)
      throw err
    }
  }))

  return router
}

// Standalone form routes — mounted at /forms
export function standaloneFormsRouter(db: Pool): Router {
  const router = Router()

  // GET /forms/:formId
  router.get('/:formId', requireAuth, asyncHandler(async (req, res) => {
    const { formId } = req.params as { formId: string }
    const { rows } = await db.query('SELECT * FROM task_forms WHERE id = $1', [formId])
    if (!rows.length) throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND)
    res.json({ data: toFormDto(rows[0]) })
  }))

  // PATCH /forms/:formId
  router.patch('/:formId', requireAuth, asyncHandler(async (req, res) => {
    const { formId } = req.params as { formId: string }
    const { rows: existing } = await db.query('SELECT * FROM task_forms WHERE id = $1', [formId])
    if (!existing.length) throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND)

    const input = validate(UpdateTaskFormSchema, req.body)
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates['name'] = input.name
    if (input.description !== undefined) updates['description'] = input.description
    if (input.fields !== undefined) updates['fields'] = JSON.stringify(input.fields)
    if (input.isActive !== undefined) updates['is_active'] = input.isActive

    const fields = Object.keys(updates)
    if (!fields.length) { res.json({ data: toFormDto(existing[0]) }); return }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows } = await db.query(
      `UPDATE task_forms SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [formId, ...Object.values(updates)],
    )
    res.json({ data: toFormDto(rows[0]) })
  }))

  // DELETE /forms/:formId
  router.delete('/:formId', requireAuth, asyncHandler(async (req, res) => {
    const { formId } = req.params as { formId: string }
    const { rowCount } = await db.query('DELETE FROM task_forms WHERE id = $1', [formId])
    if (!rowCount) throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND)
    res.status(204).end()
  }))

  // POST /forms/submit/:slug — public form submission (no auth)
  router.post('/submit/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string }
    const { rows } = await db.query('SELECT * FROM task_forms WHERE slug = $1', [slug])
    if (!rows.length) throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND)
    const form = rows[0]
    if (!form.is_active) throw new AppError(ErrorCode.TASK_FORM_INACTIVE)

    const input = validate(SubmitFormSchema, req.body)

    // Map form submission data to task fields
    const taskTitle = (input.data['title'] as string | undefined) ?? 'New Submission'
    const taskDescription = input.data['description'] as string | undefined
    const taskId = randomUUID()
    const path = taskId

    const { rows: taskRows } = await db.query(
      `INSERT INTO tasks (id, list_id, path, title, description, created_by, version)
       VALUES ($1,$2,$3,$4,$5,NULL,0) RETURNING id`,
      [taskId, form.list_id, path, taskTitle, taskDescription ?? null],
    )

    // Record the submission
    await db.query(
      'INSERT INTO form_submissions (form_id, task_id, data) VALUES ($1,$2,$3)',
      [form.id, taskRows[0].id, JSON.stringify(input.data)],
    )

    res.status(201).json({ data: { submissionId: taskId, taskId: taskRows[0].id } })
  }))

  // GET /forms/:formId/submissions — view submissions (auth required)
  router.get('/:formId/submissions', requireAuth, asyncHandler(async (req, res) => {
    const { formId } = req.params as { formId: string }
    const { rows: formRows } = await db.query('SELECT id FROM task_forms WHERE id = $1', [formId])
    if (!formRows.length) throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND)

    const { rows } = await db.query(
      'SELECT * FROM form_submissions WHERE form_id = $1 ORDER BY submitted_at DESC',
      [formId],
    )
    res.json({ data: rows })
  }))

  return router
}
