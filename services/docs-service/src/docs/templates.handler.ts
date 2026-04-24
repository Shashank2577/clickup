import { Request, Response } from 'express'
import { Router } from 'express'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// Doc Templates Handler — CRUD + use-as-template
// ============================================================

export function templatesRouter(db: Pool): Router {
  const router = Router()

  // GET /templates?workspaceId=&tags=&q=
  router.get('/', asyncHandler(listTemplatesHandler(db)))

  // POST /templates
  router.post('/', asyncHandler(createTemplateHandler(db)))

  // GET /templates/:templateId
  router.get('/:templateId', asyncHandler(getTemplateHandler(db)))

  // PATCH /templates/:templateId
  router.patch('/:templateId', asyncHandler(updateTemplateHandler(db)))

  // DELETE /templates/:templateId
  router.delete('/:templateId', asyncHandler(deleteTemplateHandler(db)))

  // POST /templates/:templateId/use
  router.post('/:templateId/use', asyncHandler(useTemplateHandler(db)))

  return router
}

// ============================================================
// List templates
// ============================================================

function listTemplatesHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.query['workspaceId'] as string | undefined
    const q = req.query['q'] as string | undefined
    const tagsParam = req.query['tags'] as string | undefined

    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')
    }

    const params: unknown[] = [workspaceId]
    const conditions: string[] = ['(t.workspace_id = $1 OR t.is_public = true)']
    let idx = 2

    if (q) {
      params.push(q)
      conditions.push(`t.name ILIKE '%' || $${idx++} || '%'`)
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map((s) => s.trim()).filter(Boolean)
      if (tags.length > 0) {
        params.push(tags)
        conditions.push(`t.tags && $${idx++}::text[]`)
      }
    }

    const { rows } = await db.query(
      `SELECT t.id, t.workspace_id AS "workspaceId", t.created_by AS "createdBy",
              t.name, t.description, t.content, t.tags, t.is_public AS "isPublic",
              t.use_count AS "useCount", t.created_at AS "createdAt", t.updated_at AS "updatedAt"
       FROM doc_templates t
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.use_count DESC, t.created_at DESC`,
      params,
    )

    res.json({ data: rows })
  }
}

// ============================================================
// Create template
// ============================================================

function createTemplateHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).auth!.userId as string
    const { name, description, content, tags, isPublic, workspaceId } = req.body as {
      name?: string
      description?: string
      content?: unknown
      tags?: string[]
      isPublic?: boolean
      workspaceId?: string
    }

    if (!name) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'name is required')
    if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

    const { rows } = await db.query(
      `INSERT INTO doc_templates
         (id, workspace_id, created_by, name, description, content, tags, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, workspace_id AS "workspaceId", created_by AS "createdBy",
                 name, description, content, tags, is_public AS "isPublic",
                 use_count AS "useCount", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        randomUUID(),
        workspaceId,
        userId,
        name,
        description ?? null,
        JSON.stringify(content ?? {}),
        tags ?? [],
        isPublic ?? false,
      ],
    )

    res.status(201).json({ data: rows[0] })
  }
}

// ============================================================
// Get single template
// ============================================================

function getTemplateHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const { templateId } = req.params

    const { rows } = await db.query(
      `SELECT id, workspace_id AS "workspaceId", created_by AS "createdBy",
              name, description, content, tags, is_public AS "isPublic",
              use_count AS "useCount", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM doc_templates
       WHERE id = $1`,
      [templateId],
    )

    if (!rows[0]) throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Template not found')

    res.json({ data: rows[0] })
  }
}

// ============================================================
// Update template
// ============================================================

function updateTemplateHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).auth!.userId as string
    const { templateId } = req.params

    const { rows: existing } = await db.query(
      'SELECT id, created_by FROM doc_templates WHERE id = $1',
      [templateId],
    )
    if (!existing[0]) throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Template not found')
    if (existing[0].created_by !== userId) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION, 'Only the creator can update this template')
    }

    const { name, description, tags, isPublic } = req.body as {
      name?: string
      description?: string
      tags?: string[]
      isPublic?: boolean
    }

    const { rows } = await db.query(
      `UPDATE doc_templates
       SET name        = COALESCE($2, name),
           description = COALESCE($3, description),
           tags        = COALESCE($4, tags),
           is_public   = COALESCE($5, is_public),
           updated_at  = NOW()
       WHERE id = $1
       RETURNING id, workspace_id AS "workspaceId", created_by AS "createdBy",
                 name, description, content, tags, is_public AS "isPublic",
                 use_count AS "useCount", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        templateId,
        name ?? null,
        description ?? null,
        tags ?? null,
        isPublic ?? null,
      ],
    )

    res.json({ data: rows[0] })
  }
}

// ============================================================
// Delete template
// ============================================================

function deleteTemplateHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).auth!.userId as string
    const { templateId } = req.params

    const { rows } = await db.query(
      'SELECT id, created_by FROM doc_templates WHERE id = $1',
      [templateId],
    )
    if (!rows[0]) throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Template not found')
    if (rows[0].created_by !== userId) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION, 'Only the creator can delete this template')
    }

    await db.query('DELETE FROM doc_templates WHERE id = $1', [templateId])

    res.status(204).end()
  }
}

// ============================================================
// Use template — create a doc from this template
// ============================================================

function useTemplateHandler(db: Pool) {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).auth!.userId as string
    const { templateId } = req.params
    const { workspaceId, name } = req.body as {
      workspaceId?: string
      name?: string
    }

    if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

    const { rows: templateRows } = await db.query(
      'SELECT id, name, content FROM doc_templates WHERE id = $1',
      [templateId],
    )
    const template = templateRows[0]
    if (!template) throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Template not found')

    const { rows } = await db.query(
      `INSERT INTO docs (id, workspace_id, title, content, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [randomUUID(), workspaceId, name ?? template.name, template.content, userId],
    )

    await db.query('UPDATE doc_templates SET use_count = use_count + 1 WHERE id = $1', [templateId])

    res.status(201).json({ data: rows[0] })
  }
}
