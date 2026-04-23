import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
// Mounted at /:taskId/pin (mergeParams: true)
export function pinnedRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
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
    // POST /:taskId/pin — pin task
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await repository.getListMetadata(task.list_id);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        await verifyMembership(meta.workspace_id, req.auth.userId);
        await db.query(`INSERT INTO pinned_tasks (user_id, task_id, list_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, task_id) DO NOTHING`, [req.auth.userId, taskId, task.list_id]);
        res.status(201).json({ data: { userId: req.auth.userId, taskId, listId: task.list_id } });
    }));
    // DELETE /:taskId/pin — unpin task
    router.delete('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        await db.query('DELETE FROM pinned_tasks WHERE user_id = $1 AND task_id = $2', [req.auth.userId, taskId]);
        res.status(204).end();
    }));
    return router;
}
// GET /lists/:listId/pinned — get pinned tasks for list (current user)
export function listPinnedHandler(db) {
    const repository = new TasksRepository(db);
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
    return asyncHandler(async (req, res) => {
        const { listId } = req.params;
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        await verifyMembership(meta.workspace_id, req.auth.userId);
        const { rows } = await db.query(`SELECT pt.task_id, pt.pinned_at,
              t.title, t.status, t.priority, t.assignee_id,
              u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM pinned_tasks pt
       JOIN tasks t ON t.id = pt.task_id AND t.deleted_at IS NULL
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE pt.user_id = $1 AND pt.list_id = $2
       ORDER BY pt.pinned_at DESC`, [req.auth.userId, listId]);
        res.json({ data: rows });
    });
}
//# sourceMappingURL=pinned.handler.js.map