import { Router } from 'express';
import { requireAuth, asyncHandler, validate } from '@clickup/sdk';
import { BulkUpdateTasksSchema } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
// POST /tasks/bulk-update
export function bulkRouter(db) {
    const router = Router();
    const repository = new TasksRepository(db);
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const input = validate(BulkUpdateTasksSchema, req.body);
        const updated = await repository.bulkUpdateTasks(input.taskIds, input.updates);
        res.json({ data: updated, meta: { count: updated.length } });
    }));
    return router;
}
//# sourceMappingURL=bulk.handler.js.map