import { Router } from 'express';
import { asyncHandler, requireAuth, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
function parseAssignBody(body) {
    if (typeof body !== 'object' ||
        body === null ||
        typeof body['assigneeId'] !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'assigneeId (UUID string) is required');
    }
    return { assigneeId: body['assigneeId'] };
}
export function commentAssignmentsRouter(db) {
    const router = Router({ mergeParams: true });
    // POST /:commentId/assign
    router.post('/:commentId/assign', requireAuth, asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { assigneeId } = parseAssignBody(req.body);
        const assignedBy = req.auth.userId;
        try {
            const result = await db.query(`INSERT INTO comment_assignments (comment_id, assignee_id, assigned_by)
           VALUES ($1, $2, $3)
           RETURNING *`, [commentId, assigneeId, assignedBy]);
            res.status(201).json({ data: result.rows[0] });
        }
        catch (err) {
            const pgErr = err;
            if (pgErr.code === '23505') {
                throw new AppError(ErrorCode.COMMENT_ALREADY_ASSIGNED, 'This comment is already assigned to this user');
            }
            throw err;
        }
    }));
    // DELETE /:commentId/assign/:userId
    router.delete('/:commentId/assign/:userId', requireAuth, asyncHandler(async (req, res) => {
        const { commentId, userId } = req.params;
        const result = await db.query(`DELETE FROM comment_assignments WHERE comment_id = $1 AND assignee_id = $2`, [commentId, userId]);
        if (result.rowCount === 0) {
            throw new AppError(ErrorCode.COMMENT_ASSIGNMENT_NOT_FOUND, 'Assignment not found');
        }
        res.status(204).end();
    }));
    // PATCH /:commentId/assign/:userId/resolve
    router.patch('/:commentId/assign/:userId/resolve', requireAuth, asyncHandler(async (req, res) => {
        const { commentId, userId } = req.params;
        const result = await db.query(`UPDATE comment_assignments
         SET resolved_at = NOW()
         WHERE comment_id = $1 AND assignee_id = $2
         RETURNING *`, [commentId, userId]);
        if (result.rowCount === 0) {
            throw new AppError(ErrorCode.COMMENT_ASSIGNMENT_NOT_FOUND, 'Assignment not found');
        }
        res.json({ data: result.rows[0] });
    }));
    // GET /:commentId/assignments
    router.get('/:commentId/assignments', requireAuth, asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const result = await db.query(`SELECT * FROM comment_assignments WHERE comment_id = $1 ORDER BY created_at ASC`, [commentId]);
        res.json({ data: result.rows });
    }));
    return router;
}
// GET /me/assigned-comments?workspaceId= (mounted separately at comment-service root)
export function myAssignedCommentsHandler(db) {
    return asyncHandler(async (req, res) => {
        const { workspaceId } = req.query;
        const userId = req.auth.userId;
        if (!workspaceId || typeof workspaceId !== 'string') {
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query parameter is required');
        }
        const result = await db.query(`SELECT ca.comment_id, ca.assignee_id, ca.assigned_by, ca.resolved_at, ca.created_at,
              c.body, c.task_id
       FROM comment_assignments ca
       JOIN comments c ON c.id = ca.comment_id
       JOIN tasks    t ON t.id = c.task_id
       JOIN lists    l ON l.id = t.list_id
       JOIN spaces   s ON s.id = l.space_id
       WHERE ca.assignee_id = $1
         AND ca.resolved_at IS NULL
         AND s.workspace_id  = $2
       ORDER BY ca.created_at DESC`, [userId, workspaceId]);
        res.json({ data: result.rows });
    });
}
//# sourceMappingURL=assignments.handler.js.map