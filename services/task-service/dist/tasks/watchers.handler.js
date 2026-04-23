import { Router } from 'express';
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
// Mounted at /:taskId/watchers (mergeParams: true)
export function watchersRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/watchers
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const watchers = await repository.getWatchers(taskId);
        res.json({ data: watchers });
    }));
    // POST /:taskId/watchers — subscribe current user (or body.userId if admin)
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const userId = req.body?.userId ?? req.auth.userId;
        await repository.addWatcher(taskId, userId);
        res.status(201).json({ data: { taskId, userId } });
    }));
    // DELETE /:taskId/watchers/:userId — unsubscribe
    router.delete('/:userId', requireAuth, asyncHandler(async (req, res) => {
        const { taskId, userId } = req.params;
        // Users can only unwatch themselves unless they're task creator
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        if (userId !== req.auth.userId && task.created_by !== req.auth.userId) {
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        }
        await repository.removeWatcher(taskId, userId);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=watchers.handler.js.map