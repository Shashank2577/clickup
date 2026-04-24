import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID } from 'crypto'

// ── List Templates ─────────────────────────────────────────────────────────────

function toListTemplateDto(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    statuses: row.statuses,
    defaultFields: row.default_fields,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function listTemplatesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/list-templates
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      // Standalone route — 404 without workspaceId
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { rows } = await db.query(
      'SELECT * FROM list_templates WHERE workspace_id = $1 ORDER BY name ASC',
      [workspaceId],
    )
    res.json({ data: rows.map(toListTemplateDto) })
  }))

  // POST /workspaces/:workspaceId/list-templates
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { name, description, statuses, defaultFields } = req.body as {
      name: string
      description?: string
      statuses?: any[]
      defaultFields?: any
    }
    if (!name || typeof name !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'name is required')
    }

    const { rows } = await db.query(
      `INSERT INTO list_templates (workspace_id, name, description, statuses, default_fields, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        workspaceId,
        name,
        description ?? null,
        statuses ? JSON.stringify(statuses) : null,
        defaultFields ? JSON.stringify(defaultFields) : null,
        req.auth.userId,
      ],
    )
    res.status(201).json({ data: toListTemplateDto(rows[0]) })
  }))

  // GET /list-templates/:templateId
  router.get('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rows } = await db.query(
      'SELECT * FROM list_templates WHERE id = $1',
      [templateId],
    )
    if (!rows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)
    res.json({ data: toListTemplateDto(rows[0]) })
  }))

  // PATCH /list-templates/:templateId
  router.patch('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rows: existing } = await db.query(
      'SELECT * FROM list_templates WHERE id = $1',
      [templateId],
    )
    if (!existing[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)

    const { name, description, statuses, defaultFields } = req.body as {
      name?: string
      description?: string
      statuses?: any[]
      defaultFields?: any
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates['name'] = name
    if (description !== undefined) updates['description'] = description
    if (statuses !== undefined) updates['statuses'] = JSON.stringify(statuses)
    if (defaultFields !== undefined) updates['default_fields'] = JSON.stringify(defaultFields)

    const fields = Object.keys(updates)
    if (!fields.length) {
      res.json({ data: toListTemplateDto(existing[0]) })
      return
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows } = await db.query(
      `UPDATE list_templates SET ${setClause} WHERE id = $1 RETURNING *`,
      [templateId, ...Object.values(updates)],
    )
    res.json({ data: toListTemplateDto(rows[0]) })
  }))

  // DELETE /list-templates/:templateId
  router.delete('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rowCount } = await db.query(
      'DELETE FROM list_templates WHERE id = $1',
      [templateId],
    )
    if (!rowCount) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)
    res.status(204).end()
  }))

  // POST /list-templates/:templateId/use — create a list from the template
  router.post('/:templateId/use', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { spaceId, folderId, name } = req.body as {
      spaceId: string
      folderId?: string
      name?: string
    }

    if (!spaceId || typeof spaceId !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'spaceId is required')
    }

    const { rows: templateRows } = await db.query(
      'SELECT * FROM list_templates WHERE id = $1',
      [templateId],
    )
    if (!templateRows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)

    const template = templateRows[0]
    const listName = name ?? template.name
    const listId = randomUUID()

    // Get max position in space
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), 0) AS max_pos FROM lists WHERE space_id = $1',
      [spaceId],
    )
    const position = (posRows[0]?.max_pos ?? 0) + 1000

    if (folderId) {
      await db.query(
        `INSERT INTO lists (id, space_id, folder_id, name, created_by, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [listId, spaceId, folderId, listName, req.auth.userId, position],
      )
    } else {
      await db.query(
        `INSERT INTO lists (id, space_id, name, created_by, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [listId, spaceId, listName, req.auth.userId, position],
      )
    }

    // Create statuses from template
    const statuses = template.statuses as any[] | null
    if (statuses && Array.isArray(statuses)) {
      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i]
        await db.query(
          `INSERT INTO list_statuses (id, list_id, name, color, position, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), listId, s.name, s.color ?? null, i * 1000, s.type ?? 'custom'],
        )
      }
    } else {
      // Seed default statuses
      const defaults = [
        { name: 'to do', color: '#d3d3d3', type: 'open' },
        { name: 'in progress', color: '#7b68ee', type: 'custom' },
        { name: 'done', color: '#6bc950', type: 'closed' },
      ]
      for (let i = 0; i < defaults.length; i++) {
        const s = defaults[i]!
        await db.query(
          `INSERT INTO list_statuses (id, list_id, name, color, position, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), listId, s.name, s.color, i * 1000, s.type],
        )
      }
    }

    const { rows: listRows } = await db.query('SELECT * FROM lists WHERE id = $1', [listId])
    res.status(201).json({ data: listRows[0] })
  }))

  return router
}

// ── Folder Templates ───────────────────────────────────────────────────────────

function toFolderTemplateDto(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    listTemplates: row.list_templates,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function folderTemplatesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/folder-templates
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { rows } = await db.query(
      'SELECT * FROM folder_templates WHERE workspace_id = $1 ORDER BY name ASC',
      [workspaceId],
    )
    res.json({ data: rows.map(toFolderTemplateDto) })
  }))

  // POST /workspaces/:workspaceId/folder-templates
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { name, description, listTemplates } = req.body as {
      name: string
      description?: string
      listTemplates?: any[]
    }
    if (!name || typeof name !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'name is required')
    }

    const { rows } = await db.query(
      `INSERT INTO folder_templates (workspace_id, name, description, list_templates, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        workspaceId,
        name,
        description ?? null,
        listTemplates ? JSON.stringify(listTemplates) : null,
        req.auth.userId,
      ],
    )
    res.status(201).json({ data: toFolderTemplateDto(rows[0]) })
  }))

  // DELETE /folder-templates/:templateId
  router.delete('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rowCount } = await db.query(
      'DELETE FROM folder_templates WHERE id = $1',
      [templateId],
    )
    if (!rowCount) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)
    res.status(204).end()
  }))

  // POST /folder-templates/:templateId/use — create a folder from template
  router.post('/:templateId/use', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { spaceId, name } = req.body as { spaceId: string; name?: string }

    if (!spaceId || typeof spaceId !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'spaceId is required')
    }

    const { rows: templateRows } = await db.query(
      'SELECT * FROM folder_templates WHERE id = $1',
      [templateId],
    )
    if (!templateRows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)

    const template = templateRows[0]
    const folderName = name ?? template.name
    const folderId = randomUUID()

    // Get max position
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), 0) AS max_pos FROM folders WHERE space_id = $1',
      [spaceId],
    )
    const position = (posRows[0]?.max_pos ?? 0) + 1000

    await db.query(
      `INSERT INTO folders (id, space_id, name, created_by, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [folderId, spaceId, folderName, req.auth.userId, position],
    )

    const { rows: folderRows } = await db.query('SELECT * FROM folders WHERE id = $1', [folderId])
    res.status(201).json({ data: folderRows[0] })
  }))

  return router
}

// ── Space Templates ────────────────────────────────────────────────────────────

function toSpaceTemplateDto(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    folderTemplates: row.folder_templates,
    features: row.features,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function spaceTemplatesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/space-templates
  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { rows } = await db.query(
      'SELECT * FROM space_templates WHERE workspace_id = $1 ORDER BY name ASC',
      [workspaceId],
    )
    res.json({ data: rows.map(toSpaceTemplateDto) })
  }))

  // POST /workspaces/:workspaceId/space-templates
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { workspaceId } = req.params as { workspaceId: string }
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }
    const { name, description, folderTemplates, features } = req.body as {
      name: string
      description?: string
      folderTemplates?: any[]
      features?: any
    }
    if (!name || typeof name !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'name is required')
    }

    const { rows } = await db.query(
      `INSERT INTO space_templates (workspace_id, name, description, folder_templates, features, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        workspaceId,
        name,
        description ?? null,
        folderTemplates ? JSON.stringify(folderTemplates) : null,
        features ? JSON.stringify(features) : null,
        req.auth.userId,
      ],
    )
    res.status(201).json({ data: toSpaceTemplateDto(rows[0]) })
  }))

  // DELETE /space-templates/:templateId
  router.delete('/:templateId', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { rowCount } = await db.query(
      'DELETE FROM space_templates WHERE id = $1',
      [templateId],
    )
    if (!rowCount) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)
    res.status(204).end()
  }))

  // POST /space-templates/:templateId/use — create a space from template
  router.post('/:templateId/use', requireAuth, asyncHandler(async (req, res) => {
    const { templateId } = req.params as { templateId: string }
    const { workspaceId, name } = req.body as { workspaceId: string; name?: string }

    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required')
    }

    const { rows: templateRows } = await db.query(
      'SELECT * FROM space_templates WHERE id = $1',
      [templateId],
    )
    if (!templateRows[0]) throw new AppError(ErrorCode.TEMPLATE_NOT_FOUND)

    const template = templateRows[0]
    const spaceName = name ?? template.name
    const spaceId = randomUUID()

    await db.query(
      `INSERT INTO spaces (id, workspace_id, name, created_by)
       VALUES ($1, $2, $3, $4)`,
      [spaceId, workspaceId, spaceName, req.auth.userId],
    )

    const { rows: spaceRows } = await db.query('SELECT * FROM spaces WHERE id = $1', [spaceId])
    res.status(201).json({ data: spaceRows[0] })
  }))

  return router
}
