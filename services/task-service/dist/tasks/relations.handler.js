import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, AddTaskRelationSchema, TaskRelationType } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
function toRelationDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        relatedTaskId: row.related_task_id,
        type: row.type,
        createdBy: row.created_by,
        createdAt: row.created_at,
        relatedTask: row.related_title ? {
            id: row.related_task_id,
            title: row.related_title,
            status: row.related_status,
            priority: row.related_priority,
        } : undefined,
    };
}
// Mounted at /:taskId/relations (mergeParams: true expected from parent router)
export function relationsRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/relations
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const relations = await repository.getRelations(taskId);
        res.json({ data: relations.map(toRelationDto) });
    }));
    // POST /:taskId/relations
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const input = validate(AddTaskRelationSchema, req.body);
        if (taskId === input.relatedTaskId)
            throw new AppError(ErrorCode.TASK_SELF_RELATION);
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const relatedTask = await repository.getTask(input.relatedTaskId);
        if (!relatedTask)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        try {
            const relation = await repository.addRelation({
                taskId,
                relatedTaskId: input.relatedTaskId,
                type: input.type,
                createdBy: req.auth.userId,
            });
            // For blocks/blocked_by, create the inverse relation automatically
            if (input.type === TaskRelationType.Blocks) {
                await repository.addRelation({
                    taskId: input.relatedTaskId,
                    relatedTaskId: taskId,
                    type: TaskRelationType.BlockedBy,
                    createdBy: req.auth.userId,
                }).catch(() => { });
            }
            else if (input.type === TaskRelationType.BlockedBy) {
                await repository.addRelation({
                    taskId: input.relatedTaskId,
                    relatedTaskId: taskId,
                    type: TaskRelationType.Blocks,
                    createdBy: req.auth.userId,
                }).catch(() => { });
            }
            res.status(201).json({ data: toRelationDto(relation) });
        }
        catch (err) {
            if (err.code === '23505')
                throw new AppError(ErrorCode.TASK_RELATION_ALREADY_EXISTS);
            throw err;
        }
    }));
    // DELETE /:taskId/relations/:relationId
    router.delete('/:relationId', requireAuth, asyncHandler(async (req, res) => {
        const { taskId, relationId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        await repository.deleteRelation(relationId, taskId);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=relations.handler.js.map