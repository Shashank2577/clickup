import { asyncHandler, validate } from '@clickup/sdk';
import { CreateGoalSchema, UpdateGoalSchema, CreateGoalTargetSchema, UpdateGoalTargetSchema, } from '@clickup/contracts';
import { goalsService } from './goals.service.js';
export const createGoalHandler = asyncHandler(async (req, res) => {
    const input = validate(CreateGoalSchema, req.body);
    const traceId = req.headers['x-trace-id'] || '';
    const goal = await goalsService.createGoal(input.workspaceId, input.name, input.description, input.dueDate, input.color, req.auth.userId, traceId);
    res.status(201).json({ data: goal });
});
export const getGoalHandler = asyncHandler(async (req, res) => {
    const goalId = req.params['goalId'];
    const traceId = req.headers['x-trace-id'] || '';
    const goal = await goalsService.getGoal(goalId, req.auth.userId, traceId);
    res.status(200).json({ data: goal });
});
export const getGoalsForWorkspaceHandler = asyncHandler(async (req, res) => {
    const workspaceId = req.params['workspaceId'];
    const traceId = req.headers['x-trace-id'] || '';
    const goals = await goalsService.getGoalsForWorkspace(workspaceId, req.auth.userId, traceId);
    res.status(200).json({ data: goals });
});
export const updateGoalHandler = asyncHandler(async (req, res) => {
    const goalId = req.params['goalId'];
    const input = validate(UpdateGoalSchema, req.body);
    const traceId = req.headers['x-trace-id'] || '';
    const updatedGoal = await goalsService.updateGoal(goalId, input, req.auth.userId, traceId);
    res.status(200).json({ data: updatedGoal });
});
export const deleteGoalHandler = asyncHandler(async (req, res) => {
    const goalId = req.params['goalId'];
    const traceId = req.headers['x-trace-id'] || '';
    await goalsService.deleteGoal(goalId, req.auth.userId, traceId);
    res.status(204).send();
});
export const addTargetHandler = asyncHandler(async (req, res) => {
    const goalId = req.params['goalId'];
    const input = validate(CreateGoalTargetSchema, req.body);
    const traceId = req.headers['x-trace-id'] || '';
    const target = await goalsService.addTarget(goalId, { ...input, type: input.type }, req.auth.userId, traceId);
    res.status(201).json({ data: target });
});
export const updateTargetHandler = asyncHandler(async (req, res) => {
    const goalId = req.params['goalId'];
    const targetId = req.params['targetId'];
    const input = validate(UpdateGoalTargetSchema, req.body);
    const traceId = req.headers['x-trace-id'] || '';
    const updatedTarget = await goalsService.updateTarget(goalId, targetId, input, req.auth.userId, traceId);
    res.status(200).json({ data: updatedTarget });
});
//# sourceMappingURL=goals.handler.js.map