import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateChecklistSchema, CreateChecklistItemSchema, UpdateChecklistItemSchema } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
function toChecklistDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        title: row.title,
        position: row.position,
        createdAt: row.created_at,
        items: row.items ?? [],
    };
}
function toItemDto(row) {
    return {
        id: row.id,
        checklistId: row.checklist_id,
        title: row.title,
        completed: row.completed,
        assigneeId: row.assignee_id,
        dueDate: row.due_date,
        position: row.position,
        updatedAt: row.updated_at,
    };
}
// Task-level checklist routes — mounted at /:taskId/checklists (mergeParams: true)
export function checklistsRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/checklists
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const checklists = await repository.getChecklists(taskId);
        res.json({ data: checklists.map(toChecklistDto) });
    }));
    // POST /:taskId/checklists
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const input = validate(CreateChecklistSchema, req.body);
        const checklist = await repository.createChecklist(taskId, input.title ?? 'Checklist');
        res.status(201).json({ data: toChecklistDto(checklist) });
    }));
    // POST /:taskId/checklists/:checklistId/items
    router.post('/:checklistId/items', requireAuth, asyncHandler(async (req, res) => {
        const { taskId, checklistId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const checklist = await repository.getChecklist(checklistId);
        if (!checklist || checklist.task_id !== taskId)
            throw new AppError(ErrorCode.CHECKLIST_NOT_FOUND);
        const input = validate(CreateChecklistItemSchema, req.body);
        const item = await repository.createChecklistItem(checklistId, {
            title: input.title,
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        });
        res.status(201).json({ data: toItemDto(item) });
    }));
    return router;
}
// Standalone checklist/item routes — mounted at root level
export function checklistItemsRouter(db) {
    const router = Router();
    const repository = new TasksRepository(db);
    // DELETE /checklists/:checklistId
    router.delete('/:checklistId', requireAuth, asyncHandler(async (req, res) => {
        const { checklistId } = req.params;
        const checklist = await repository.getChecklist(checklistId);
        if (!checklist)
            throw new AppError(ErrorCode.CHECKLIST_NOT_FOUND);
        await repository.deleteChecklist(checklistId);
        res.status(204).end();
    }));
    return router;
}
export function checklistItemRouter(db) {
    const router = Router();
    const repository = new TasksRepository(db);
    // PATCH /checklist-items/:itemId
    router.patch('/:itemId', requireAuth, asyncHandler(async (req, res) => {
        const { itemId } = req.params;
        const item = await repository.getChecklistItem(itemId);
        if (!item)
            throw new AppError(ErrorCode.CHECKLIST_ITEM_NOT_FOUND);
        const input = validate(UpdateChecklistItemSchema, req.body);
        const updated = await repository.updateChecklistItem(itemId, input);
        res.json({ data: toItemDto(updated) });
    }));
    // DELETE /checklist-items/:itemId
    router.delete('/:itemId', requireAuth, asyncHandler(async (req, res) => {
        const { itemId } = req.params;
        const item = await repository.getChecklistItem(itemId);
        if (!item)
            throw new AppError(ErrorCode.CHECKLIST_ITEM_NOT_FOUND);
        await repository.deleteChecklistItem(itemId);
        res.status(204).end();
    }));
    // POST /checklist-items/:itemId/convert — convert checklist item to task
    router.post('/:itemId/convert', requireAuth, asyncHandler(async (req, res) => {
        const { itemId } = req.params;
        const { asSubtask } = req.query;
        const item = await repository.getChecklistItem(itemId);
        if (!item)
            throw new AppError(ErrorCode.CHECKLIST_ITEM_NOT_FOUND);
        const checklist = await repository.getChecklist(item.checklist_id);
        if (!checklist)
            throw new AppError(ErrorCode.CHECKLIST_NOT_FOUND);
        const parentTask = await repository.getTask(checklist.task_id);
        if (!parentTask)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const listId = parentTask.list_id;
        const newId = randomUUID();
        const parentId = asSubtask === 'true' ? checklist.task_id : null;
        const basePath = parentId ? parentTask.path : '/' + listId + '/';
        const newPath = basePath + newId + '/';
        const newTask = await repository.createTask({
            id: newId,
            listId,
            title: item.title,
            parentId,
            path: newPath,
            createdBy: req.auth.userId,
        });
        // Mark checklist item as completed
        await repository.updateChecklistItem(itemId, { completed: true });
        res.status(201).json({ data: { task: newTask } });
    }));
    return router;
}
//# sourceMappingURL=checklists.handler.js.map