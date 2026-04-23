import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, asyncHandler, AppError, createServiceClient } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
// Mounted at /:taskId/duplicate (mergeParams: true)
export function duplicateRouter(db) {
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
    // POST /:taskId/duplicate
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const source = await repository.getTask(taskId);
        if (!source)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const meta = await repository.getListMetadata(source.list_id);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        await verifyMembership(meta.workspace_id, req.auth.userId);
        const newId = randomUUID();
        const listId = source.list_id;
        const newPath = '/' + listId + '/' + newId + '/';
        // Build insert: copy core fields
        const insertFields = [
            'id', 'list_id', 'path', 'title', 'created_by', 'version',
        ];
        const insertValues = [
            newId, listId, newPath, 'Copy of ' + source.title, req.auth.userId, 0,
        ];
        // Optional fields — only include if set on source
        const optionalFields = [
            ['description', source.description],
            ['priority', source.priority],
            ['assignee_id', source.assignee_id],
            ['status', source.status],
            ['start_date', source.start_date],
            ['due_date', source.due_date],
            ['sprint_points', source.sprint_points],
            ['task_type_id', source.task_type_id],
        ];
        for (const [col, val] of optionalFields) {
            if (val !== null && val !== undefined) {
                insertFields.push(col);
                insertValues.push(val);
            }
        }
        const placeholders = insertValues.map((_, i) => '$' + (i + 1)).join(', ');
        const { rows } = await db.query('INSERT INTO tasks (' + insertFields.join(', ') + ') VALUES (' + placeholders + ') RETURNING *', insertValues);
        const newTask = rows[0];
        // Copy tags
        const tags = await repository.getTags(taskId);
        for (const tag of tags) {
            await repository.addTag(newId, tag);
        }
        // Copy checklists (excluding completed items)
        const checklists = await repository.getChecklists(taskId);
        for (const cl of checklists) {
            const newChecklist = await repository.createChecklist(newId, cl.title);
            const items = Array.isArray(cl.items) ? cl.items : [];
            for (const item of items) {
                if (item.completed)
                    continue;
                await repository.createChecklistItem(newChecklist.id, {
                    title: item.title,
                    ...(item.assignee_id !== null && item.assignee_id !== undefined ? { assigneeId: item.assignee_id } : {}),
                    ...(item.due_date !== null && item.due_date !== undefined ? { dueDate: item.due_date } : {}),
                });
            }
        }
        res.status(201).json({ data: newTask });
    }));
    return router;
}
//# sourceMappingURL=duplicate.handler.js.map