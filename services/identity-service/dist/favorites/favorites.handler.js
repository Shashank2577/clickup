import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateFavoriteSchema, ReorderFavoritesSchema } from '@clickup/contracts';
function toFavoriteDto(row) {
    return {
        id: row.id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        itemType: row.item_type,
        itemId: row.item_id,
        itemName: row.item_name,
        position: row.position,
        createdAt: row.created_at.toISOString(),
    };
}
// Mounted at: /workspaces/:workspaceId/favorites
export function favoritesRouter(db) {
    const router = Router({ mergeParams: true });
    // GET /workspaces/:workspaceId/favorites
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const r = await db.query(`SELECT id, user_id, workspace_id, item_type, item_id, item_name, position, created_at
         FROM favorites
         WHERE user_id = $1 AND workspace_id = $2
         ORDER BY position ASC, created_at ASC`, [req.auth.userId, workspaceId]);
        res.json({ data: r.rows.map(toFavoriteDto) });
    }));
    // POST /workspaces/:workspaceId/favorites
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const input = validate(CreateFavoriteSchema, req.body);
        // Get next position
        const posR = await db.query(`SELECT MAX(position) AS max FROM favorites WHERE user_id = $1 AND workspace_id = $2`, [req.auth.userId, workspaceId]);
        const nextPos = (posR.rows[0]?.max ?? -1) + 1;
        try {
            const r = await db.query(`INSERT INTO favorites (user_id, workspace_id, item_type, item_id, item_name, position)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, workspace_id, item_type, item_id, item_name, position, created_at`, [req.auth.userId, workspaceId, input.itemType, input.itemId, input.itemName, nextPos]);
            res.status(201).json({ data: toFavoriteDto(r.rows[0]) });
        }
        catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
                throw new AppError(ErrorCode.FAVORITE_ALREADY_EXISTS);
            }
            throw err;
        }
    }));
    // DELETE /workspaces/:workspaceId/favorites/:id
    router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, id } = req.params;
        if (!workspaceId || !id)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const r = await db.query(`DELETE FROM favorites WHERE id = $1 AND user_id = $2 AND workspace_id = $3`, [id, req.auth.userId, workspaceId]);
        if (r.rowCount === 0)
            throw new AppError(ErrorCode.FAVORITE_NOT_FOUND);
        res.status(204).end();
    }));
    // PATCH /workspaces/:workspaceId/favorites/reorder
    router.patch('/reorder', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const input = validate(ReorderFavoritesSchema, req.body);
        // Update positions in order using a series of UPDATE statements in a transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (let i = 0; i < input.favoriteIds.length; i++) {
                await client.query(`UPDATE favorites SET position = $1 WHERE id = $2 AND user_id = $3 AND workspace_id = $4`, [i, input.favoriteIds[i], req.auth.userId, workspaceId]);
            }
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        res.json({ data: { reordered: input.favoriteIds.length } });
    }));
    return router;
}
//# sourceMappingURL=favorites.handler.js.map