import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateTaskTemplateSchema, UpdateTaskTemplateSchema } from '@clickup/contracts'
import { TasksRepository } from './tasks.repository.js'
import { randomUUID } from 'crypto'

function toTemplateDto(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    templateData: row.template_data,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Mounted at /workspaces/:workspaceId/task-templates
export function taskTemplatesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/task-templates
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    const { rows } = await db.query(
      'SELECT * FROM task_templates WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    )
    res.json({ data: rows.map(toTemplateDto) })
  }))

  // POST /workspaces/:workspaceId/task-templates
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    const input = validate(CreateTaskTemplateSchema, req.body)
    const { rows } = await db.query(
      'INSERT INTO task_templates (workspace_id, name, description, template_data, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [workspaceId, input.name, input.description ?? null, JSON.stringify(input.templateData), req.auth.userId],
    )
    res.status(201).json({ data: toTemplateDto(rows[0]) })
  }))

  // GET /task-templates/:templateId
  router.get('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rows } = await db.query('SELECT * FROM task_templates WHERE id = $1', [templateId])
    if (!rows.length) throw new AppError(ErrorCode.TASK_TEMPLATE_NOT_FOUND)
    res.json({ data: toTemplateDto(rows[0]) })
  }))

  // PATCH /task-templates/:templateId
  router.patch('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rows: existing } = await db.query('SELECT * FROM task_templates WHERE id = $1', [templateId])
    if (!existing.length) throw new AppError(ErrorCode.TASK_TEMPLATE_NOT_FOUND)

    const input = validate(UpdateTaskTemplateSchema, req.body)
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates['name'] = input.name
    if (input.description !== undefined) updates['description'] = input.description
    if (input.templateData !== undefined) updates['template_data'] = JSON.stringify(input.templateData)

    const fields = Object.keys(updates)
    if (!fields.length) { res.json({ data: toTemplateDto(existing[0]) }); return }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows } = await db.query(
      `UPDATE task_templates SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [templateId, ...Object.values(updates)],
    )
    res.json({ data: toTemplateDto(rows[0]) })
  }))

  // DELETE /task-templates/:templateId
  router.delete('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rowCount } = await db.query('DELETE FROM task_templates WHERE id = $1', [templateId])
    if (!rowCount) throw new AppError(ErrorCode.TASK_TEMPLATE_NOT_FOUND)
    res.status(204).end()
  }))

  // POST /task-templates/:templateId/use — create task from template
  router.post('/:templateId/use', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rows } = await db.query('SELECT * FROM task_templates WHERE id = $1', [templateId])
    if (!rows.length) throw new AppError(ErrorCode.TASK_TEMPLATE_NOT_FOUND)

    const template = rows[0]
    const { listId, parentId } = req.body as { listId?: string; parentId?: string }
    if (!listId) throw new AppError(ErrorCode.LIST_NOT_FOUND)

    const taskId = randomUUID()
    const td = template.template_data as any
    const taskTitle = (req.body.title as string | undefined) ?? td.title ?? 'New Task'
    const path = parentId ? `${parentId}.${taskId}` : taskId

    const { rows: taskRows } = await db.query(
      `INSERT INTO tasks (id, list_id, path, title, description, priority, parent_id, created_by, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0) RETURNING *`,
      [taskId, listId, path, taskTitle, td.description ?? null, td.priority ?? 'none', parentId ?? null, req.auth.userId],
    )
    res.status(201).json({ data: taskRows[0] })
  }))

  return router
}
