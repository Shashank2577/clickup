import { Router } from 'express';
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
function toActivityDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        action: row.action,
        field: row.field,
        oldValue: row.old_value,
        newValue: row.new_value,
        createdAt: row.created_at,
    };
}
// Mounted at /:taskId/activity (mergeParams: true)
export function activityRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/activity
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const page = Math.max(1, parseInt(req.query['page'] || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query['pageSize'] || '50', 10)));
        const offset = (page - 1) * pageSize;
        const { rows } = await db.query('SELECT * FROM task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [taskId, pageSize, offset]);
        const { rows: countRows } = await db.query('SELECT COUNT(*) FROM task_activity WHERE task_id = $1', [taskId]);
        const total = parseInt(countRows[0].count, 10);
        res.json({
            data: rows.map(toActivityDto),
            meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        });
    }));
    return router;
}
// Helper exported for use in task mutation handlers to record activity
export async function logActivity(db, entry) {
    await db.query('INSERT INTO task_activity (task_id, user_id, action, field, old_value, new_value) VALUES ($1,$2,$3,$4,$5,$6)', [
        entry.taskId,
        entry.userId,
        entry.action,
        entry.field ?? null,
        entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
        entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
    ]);
}
//# sourceMappingURL=activity.handler.js.map