import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateSavedSearchSchema, UpdateSavedSearchSchema } from '@clickup/contracts';
function toDto(row) {
    return {
        id: row.id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        name: row.name,
        query: row.query,
        filters: row.filters,
        createdAt: row.created_at.toISOString(),
    };
}
// Mounted at: /workspaces/:workspaceId/saved-searches
export function savedSearchesRouter(db) {
    const router = Router({ mergeParams: true });
    // GET /workspaces/:workspaceId/saved-searches
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const r = await db.query(`SELECT id, user_id, workspace_id, name, query, filters, created_at
         FROM saved_searches
         WHERE user_id = $1 AND workspace_id = $2
         ORDER BY created_at DESC`, [req.auth.userId, workspaceId]);
        res.json({ data: r.rows.map(toDto) });
    }));
    // POST /workspaces/:workspaceId/saved-searches
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        // Parse body — workspaceId from body is ignored; we use path param
        const input = validate(CreateSavedSearchSchema, { ...req.body, workspaceId });
        const r = await db.query(`INSERT INTO saved_searches (user_id, workspace_id, name, query, filters)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, workspace_id, name, query, filters, created_at`, [req.auth.userId, workspaceId, input.name, input.query, JSON.stringify(input.filters)]);
        res.status(201).json({ data: toDto(r.rows[0]) });
    }));
    // PATCH /workspaces/:workspaceId/saved-searches/:id
    router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        if (!workspaceId || !id)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const input = validate(UpdateSavedSearchSchema, req.body);
        const setClauses = [];
        const values = [];
        let idx = 1;
        if (input.name !== undefined) {
            setClauses.push(`name = $${idx++}`);
            values.push(input.name);
        }
        if (input.query !== undefined) {
            setClauses.push(`query = $${idx++}`);
            values.push(input.query);
        }
        if (input.filters !== undefined) {
            setClauses.push(`filters = $${idx++}`);
            values.push(JSON.stringify(input.filters));
        }
        if (setClauses.length === 0) {
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'At least one field is required');
        }
        values.push(id, req.auth.userId, workspaceId);
        const r = await db.query(`UPDATE saved_searches SET ${setClauses.join(', ')}
         WHERE id = $${idx++} AND user_id = $${idx++} AND workspace_id = $${idx++}
         RETURNING id, user_id, workspace_id, name, query, filters, created_at`, values);
        if (r.rowCount === 0)
            throw new AppError(ErrorCode.SAVED_SEARCH_NOT_FOUND);
        res.json({ data: toDto(r.rows[0]) });
    }));
    // DELETE /workspaces/:workspaceId/saved-searches/:id
    router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        if (!workspaceId || !id)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const r = await db.query(`DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 AND workspace_id = $3`, [id, req.auth.userId, workspaceId]);
        if (r.rowCount === 0)
            throw new AppError(ErrorCode.SAVED_SEARCH_NOT_FOUND);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=saved-searches.handler.js.map