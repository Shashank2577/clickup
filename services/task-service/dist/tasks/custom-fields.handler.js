import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateCustomFieldSchema, SetCustomFieldValueSchema } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
function toFieldDto(row) {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        type: row.type,
        config: row.config,
        createdAt: row.created_at,
    };
}
// GET/POST /:workspaceId/custom-fields — workspace-level field definitions
// Mounted at /workspaces in index.ts; gateway routes /api/v1/custom-fields to task-service
export function workspaceCustomFieldsRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /custom-fields/:workspaceId  →  GET /api/v1/custom-fields/:workspaceId
    router.get('/:workspaceId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const fields = await repository.getCustomFields(workspaceId);
        res.json({ data: fields.map(toFieldDto) });
    }));
    // POST /custom-fields/:workspaceId  →  POST /api/v1/custom-fields/:workspaceId
    router.post('/:workspaceId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const input = validate(CreateCustomFieldSchema, req.body);
        const field = await repository.createCustomField({
            workspaceId,
            name: input.name,
            type: input.type,
            config: input.config ?? {},
        });
        res.status(201).json({ data: toFieldDto(field) });
    }));
    return router;
}
// GET /:taskId/custom-fields — all field values on a task
// PUT /:taskId/custom-fields/:fieldId — set a field value
export function taskCustomFieldsRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const fields = await repository.getTaskCustomFields(taskId);
        res.json({
            data: fields.map(f => ({
                fieldId: f.id,
                workspaceId: f.workspace_id,
                name: f.name,
                type: f.type,
                config: f.config,
                value: f.value,
                updatedAt: f.value_updated_at,
            })),
        });
    }));
    router.put('/:fieldId', requireAuth, asyncHandler(async (req, res) => {
        const { taskId, fieldId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const input = validate(SetCustomFieldValueSchema, req.body);
        await repository.setTaskCustomFieldValue(taskId, fieldId, input.value);
        res.json({ data: { taskId, fieldId, value: input.value } });
    }));
    return router;
}
//# sourceMappingURL=custom-fields.handler.js.map