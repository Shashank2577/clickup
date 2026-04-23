import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
// Mounted at /workspaces (handles /workspaces/:workspaceId/task-types)
export function taskTypesRouter(db) {
    const router = Router({ mergeParams: true });
    const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001';
    async function verifyMembership(workspaceId, userId) {
        const client = createServiceClient(identityUrl, {});
        try {
            const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId);
            const member = response.data?.data || response.data;
            if (!member)
                throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
        catch (err) {
            if (err instanceof AppError)
                throw err;
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    }
    function toDto(row) {
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            name: row.name,
            color: row.color,
            icon: row.icon ?? null,
            position: row.position,
            isDefault: row.is_default,
            createdAt: row.created_at,
        };
    }
    // GET /workspaces/:workspaceId/task-types
    router.get('/:workspaceId/task-types', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        await verifyMembership(workspaceId, req.auth.userId);
        const { rows } = await db.query('SELECT * FROM task_types WHERE workspace_id = $1 ORDER BY position ASC, created_at ASC', [workspaceId]);
        res.json({ data: rows.map(toDto) });
    }));
    // POST /workspaces/:workspaceId/task-types
    router.post('/:workspaceId/task-types', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        await verifyMembership(workspaceId, req.auth.userId);
        const { name, color, icon, position, isDefault } = req.body;
        if (!name || typeof name !== 'string') {
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'name is required');
        }
        // Get next position
        const { rows: posRows } = await db.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM task_types WHERE workspace_id = $1', [workspaceId]);
        const nextPosition = position ?? posRows[0].next;
        try {
            const { rows } = await db.query(`INSERT INTO task_types (workspace_id, name, color, icon, position, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`, [workspaceId, name, color ?? '#6366f1', icon ?? null, nextPosition, isDefault ?? false]);
            res.status(201).json({ data: toDto(rows[0]) });
        }
        catch (err) {
            if (err.code === '23505')
                throw new AppError(ErrorCode.TASK_TYPE_ALREADY_EXISTS);
            throw err;
        }
    }));
    // PATCH /workspaces/:workspaceId/task-types/:id
    router.patch('/:workspaceId/task-types/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        await verifyMembership(workspaceId, req.auth.userId);
        // Check exists
        const { rows: existing } = await db.query('SELECT * FROM task_types WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
        if (!existing[0])
            throw new AppError(ErrorCode.TASK_TYPE_NOT_FOUND);
        const allowedFields = {
            name: 'name', color: 'color', icon: 'icon', position: 'position', isDefault: 'is_default',
        };
        const updates = {};
        for (const [key, col] of Object.entries(allowedFields)) {
            const val = req.body[key];
            if (val !== undefined)
                updates[col] = val;
        }
        if (Object.keys(updates).length === 0) {
            res.json({ data: toDto(existing[0]) });
            return;
        }
        const fields = Object.keys(updates);
        const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
        try {
            const { rows } = await db.query(`UPDATE task_types SET ${setClause} WHERE id = $1 AND workspace_id = $2 RETURNING *`, [id, workspaceId, ...Object.values(updates)]);
            res.json({ data: toDto(rows[0]) });
        }
        catch (err) {
            if (err.code === '23505')
                throw new AppError(ErrorCode.TASK_TYPE_ALREADY_EXISTS);
            throw err;
        }
    }));
    // DELETE /workspaces/:workspaceId/task-types/:id
    router.delete('/:workspaceId/task-types/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        await verifyMembership(workspaceId, req.auth.userId);
        const { rowCount } = await db.query('DELETE FROM task_types WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
        if (!rowCount)
            throw new AppError(ErrorCode.TASK_TYPE_NOT_FOUND);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=task-types.handler.js.map