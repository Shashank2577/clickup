import { Router } from 'express';
import { asyncHandler, requireAuth, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
function parseCreateBody(body) {
    if (typeof body !== 'object' || body === null) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Request body must be an object');
    }
    const b = body;
    if (typeof b['name'] !== 'string' || b['name'].length === 0) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'name (non-empty string) is required');
    }
    const result = { name: b['name'] };
    if (b['color'] !== undefined) {
        if (typeof b['color'] !== 'string') {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'color must be a string');
        }
        result.color = b['color'];
    }
    return result;
}
function parseUpdateBody(body) {
    if (typeof body !== 'object' || body === null) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Request body must be an object');
    }
    const b = body;
    const result = {};
    if (b['name'] !== undefined) {
        if (typeof b['name'] !== 'string' || b['name'].length === 0) {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'name must be a non-empty string');
        }
        result.name = b['name'];
    }
    if (b['color'] !== undefined) {
        if (typeof b['color'] !== 'string') {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'color must be a string');
        }
        result.color = b['color'];
    }
    return result;
}
export function goalFoldersRouter(db) {
    const router = Router({ mergeParams: true });
    // GET /workspace/:workspaceId/goal-folders
    router.get('/workspace/:workspaceId/goal-folders', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const result = await db.query(`SELECT * FROM goal_folders WHERE workspace_id = $1 ORDER BY position ASC, created_at ASC`, [workspaceId]);
        res.json({ data: result.rows });
    }));
    // POST /workspace/:workspaceId/goal-folders
    router.post('/workspace/:workspaceId/goal-folders', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const input = parseCreateBody(req.body);
        const userId = req.auth.userId;
        // Compute next position
        const posResult = await db.query(`SELECT MAX(position) AS max FROM goal_folders WHERE workspace_id = $1`, [workspaceId]);
        const nextPosition = posResult.rows[0]?.max != null ? parseInt(posResult.rows[0].max, 10) + 1 : 0;
        try {
            let result;
            if (input.color !== undefined) {
                result = await db.query(`INSERT INTO goal_folders (workspace_id, name, position, created_by, color)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`, [workspaceId, input.name, nextPosition, userId, input.color]);
            }
            else {
                result = await db.query(`INSERT INTO goal_folders (workspace_id, name, position, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`, [workspaceId, input.name, nextPosition, userId]);
            }
            res.status(201).json({ data: result.rows[0] });
        }
        catch (err) {
            const pgErr = err;
            if (pgErr.code === '23505') {
                throw new AppError(ErrorCode.GOAL_FOLDER_NAME_TAKEN, 'A folder with this name already exists in this workspace');
            }
            throw err;
        }
    }));
    // PATCH /workspace/:workspaceId/goal-folders/:id
    router.patch('/workspace/:workspaceId/goal-folders/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        const input = parseUpdateBody(req.body);
        // Verify folder exists and belongs to workspace
        const existing = await db.query(`SELECT * FROM goal_folders WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        if (existing.rows.length === 0) {
            throw new AppError(ErrorCode.GOAL_FOLDER_NOT_FOUND, 'Goal folder not found');
        }
        const setClauses = ['updated_at = NOW()'];
        const values = [];
        let paramIndex = 1;
        if (input.name !== undefined) {
            setClauses.push(`name = $${paramIndex}`);
            values.push(input.name);
            paramIndex++;
        }
        if (input.color !== undefined) {
            setClauses.push(`color = $${paramIndex}`);
            values.push(input.color);
            paramIndex++;
        }
        if (values.length === 0) {
            res.json({ data: existing.rows[0] });
            return;
        }
        values.push(id, workspaceId);
        try {
            const result = await db.query(`UPDATE goal_folders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND workspace_id = $${paramIndex + 1} RETURNING *`, values);
            res.json({ data: result.rows[0] });
        }
        catch (err) {
            const pgErr = err;
            if (pgErr.code === '23505') {
                throw new AppError(ErrorCode.GOAL_FOLDER_NAME_TAKEN, 'A folder with this name already exists in this workspace');
            }
            throw err;
        }
    }));
    // DELETE /workspace/:workspaceId/goal-folders/:id
    router.delete('/workspace/:workspaceId/goal-folders/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        const result = await db.query(`DELETE FROM goal_folders WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        if (result.rowCount === 0) {
            throw new AppError(ErrorCode.GOAL_FOLDER_NOT_FOUND, 'Goal folder not found');
        }
        // goals.folder_id is SET NULL by ON DELETE SET NULL foreign key constraint
        res.status(204).end();
    }));
    // GET /workspace/:workspaceId/goal-folders/:id/goals
    router.get('/workspace/:workspaceId/goal-folders/:id/goals', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        // Verify the folder exists and belongs to this workspace
        const folderCheck = await db.query(`SELECT id FROM goal_folders WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
        if (folderCheck.rows.length === 0) {
            throw new AppError(ErrorCode.GOAL_FOLDER_NOT_FOUND, 'Goal folder not found');
        }
        const result = await db.query(`SELECT * FROM goals WHERE folder_id = $1 AND workspace_id = $2 ORDER BY created_at ASC`, [id, workspaceId]);
        res.json({ data: result.rows });
    }));
    return router;
}
//# sourceMappingURL=goal-folders.handler.js.map