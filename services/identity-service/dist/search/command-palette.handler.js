import { Router } from 'express';
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
// Mounted at: /command-palette
export function commandPaletteRouter(db) {
    const router = Router();
    // GET /command-palette?q=&workspaceId=
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const workspaceId = req.query['workspaceId'];
        const q = req.query['q'];
        if (!workspaceId) {
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query parameter is required');
        }
        // Verify workspace membership
        const memberR = await db.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, req.auth.userId]);
        if (!memberR.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const searchTerm = q ? `%${q}%` : '%';
        // Search spaces
        const spacesR = await db.query(`SELECT id, name, 'space' AS type
         FROM spaces
         WHERE workspace_id = $1 AND name ILIKE $2 AND deleted_at IS NULL
         LIMIT 5`, [workspaceId, searchTerm]);
        // Search lists (via spaces join)
        const listsR = await db.query(`SELECT l.id, l.name, 'list' AS type, l.space_id
         FROM lists l
         JOIN spaces s ON s.id = l.space_id
         WHERE s.workspace_id = $1 AND l.name ILIKE $2
           AND l.is_archived = FALSE AND s.deleted_at IS NULL
         LIMIT 5`, [workspaceId, searchTerm]);
        const items = [
            ...spacesR.rows.map((r) => ({ id: r.id, name: r.name, type: r.type })),
            ...listsR.rows.map((r) => ({ id: r.id, name: r.name, type: r.type, meta: { spaceId: r.space_id } })),
        ];
        // Cap at 20 total items
        const limited = items.slice(0, 20);
        res.json({ data: { items: limited } });
    }));
    return router;
}
//# sourceMappingURL=command-palette.handler.js.map