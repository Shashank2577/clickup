import { Router } from 'express';
import { asyncHandler, requireAuth, validate } from '@clickup/sdk';
import { CreateTaskSchema, UpdateTaskSchema } from '@clickup/contracts';
export function createTasksRouter(service) {
    const router = Router();
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const input = validate(CreateTaskSchema, req.body);
        const task = await service.createTask(input, req.user.id);
        res.status(201).json({ data: task });
    }));
    router.get('/:taskId', requireAuth, asyncHandler(async (req, res) => {
        const task = await service.getTask(req.params['taskId'], req.user.id);
        res.json({ data: task });
    }));
    router.patch('/:taskId', requireAuth, asyncHandler(async (req, res) => {
        const input = validate(UpdateTaskSchema, req.body);
        const task = await service.updateTask(req.params['taskId'], input, req.user.id);
        res.json({ data: task });
    }));
    router.delete('/:taskId', requireAuth, asyncHandler(async (req, res) => {
        await service.deleteTask(req.params['taskId'], req.user.id);
        res.status(204).send();
    }));
    return router;
}
//# sourceMappingURL=tasks.handler.js.map