import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID } from 'crypto'

function toTemplateDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config,
    conditions: row.conditions,
    actions: row.actions,
    createdAt: row.created_at,
  }
}

export function automationTemplatesRouter(db: Pool): Router {
  const router = Router()

  // GET /templates — list all templates, optionally filter by ?category=
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { category } = req.query
    let query = 'SELECT * FROM automation_templates'
    const params: string[] = []

    if (category && typeof category === 'string') {
      query += ' WHERE category = $1'
      params.push(category)
    }

    query += ' ORDER BY name ASC'

    const { rows } = await db.query(query, params)
    res.json({ data: rows.map(toTemplateDto) })
  }))

  // GET /templates/:templateId — get single template
  router.get('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params
    const { rows } = await db.query(
      'SELECT * FROM automation_templates WHERE id = $1',
      [templateId],
    )
    if (!rows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)
    res.json({ data: toTemplateDto(rows[0]) })
  }))

  // POST /templates/:templateId/use — create automation from template
  router.post('/:templateId/use', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params
    const { workspaceId, name, overrides } = req.body as {
      workspaceId: string
      name?: string
      overrides?: { actions?: any[] }
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }

    const { rows: templateRows } = await db.query(
      'SELECT * FROM automation_templates WHERE id = $1',
      [templateId],
    )
    if (!templateRows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)

    const template = templateRows[0]
    const automationId = randomUUID()
    const automationName = name ?? template.name
    const actions = overrides?.actions ?? template.actions

    const { rows } = await db.query(
      `INSERT INTO automations (id, workspace_id, name, trigger_type, trigger_config, conditions, actions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        automationId,
        workspaceId,
        automationName,
        template.trigger_type,
        template.trigger_config,
        JSON.stringify(template.conditions),
        JSON.stringify(actions),
        req.auth!.userId,
      ],
    )

    res.status(201).json({ data: rows[0] })
  }))

  return router
}
