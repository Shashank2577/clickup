import { GOAL_EVENTS } from '@clickup/contracts';
import { AppError, publish, createServiceClient } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { goalsRepository } from './goals.repository.js';
export function computeGoalProgress(targets) {
    if (targets.length === 0)
        return 0;
    const targetProgressValues = targets.map(t => computeTargetProgress(t));
    const sum = targetProgressValues.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / targets.length);
}
export function computeTargetProgress(target) {
    switch (target.type) {
        case 'boolean':
            return target.currentValue >= 1 ? 100 : 0;
        case 'task':
            return target.currentValue >= 1 ? 100 : 0;
        case 'number':
        case 'currency':
            if (!target.targetValue || target.targetValue <= 0)
                return 0;
            const pct = (target.currentValue / target.targetValue) * 100;
            return Math.min(100, Math.max(0, Math.round(pct)));
        default:
            return 0;
    }
}
export const goalsService = {
    async verifyWorkspaceMembership(workspaceId, userId, traceId) {
        const identityClient = createServiceClient(process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001');
        try {
            await identityClient.get(`/internal/workspaces/${workspaceId}/members/${userId}`, {
                headers: { 'x-trace-id': traceId }
            });
        }
        catch (err) {
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        }
    },
    async createGoal(workspaceId, name, description, dueDate, color, userId, traceId) {
        await this.verifyWorkspaceMembership(workspaceId, userId, traceId);
        const goal = await goalsRepository.createGoal(workspaceId, name, description, dueDate, userId, color);
        await publish(GOAL_EVENTS.CREATED, { goalId: goal.id, workspaceId, createdBy: userId });
        return goal;
    },
    async getGoal(goalId, userId, traceId) {
        const goal = await goalsRepository.getGoal(goalId);
        if (!goal)
            throw new AppError(ErrorCode.GOAL_NOT_FOUND);
        await this.verifyWorkspaceMembership(goal.workspace_id, userId, traceId);
        return goal;
    },
    async getGoalsForWorkspace(workspaceId, userId, traceId) {
        await this.verifyWorkspaceMembership(workspaceId, userId, traceId);
        return goalsRepository.getGoalsForWorkspace(workspaceId);
    },
    async updateGoal(goalId, input, userId, traceId) {
        await this.getGoal(goalId, userId, traceId);
        return goalsRepository.updateGoal(goalId, input.name, input.description, input.dueDate, input.color);
    },
    async deleteGoal(goalId, userId, traceId) {
        await this.getGoal(goalId, userId, traceId);
        await goalsRepository.deleteGoal(goalId);
    },
    async addTarget(goalId, input, userId, traceId) {
        await this.getGoal(goalId, userId, traceId);
        const target = await goalsRepository.createTarget(goalId, input.name, input.type, input.targetValue, input.currentValue, input.taskId);
        await this.recomputeProgress(goalId);
        return target;
    },
    async updateTarget(goalId, targetId, input, userId, traceId) {
        await this.getGoal(goalId, userId, traceId);
        const target = await goalsRepository.updateTarget(targetId, goalId, input.name, input.currentValue, input.targetValue, input.taskId);
        await this.recomputeProgress(goalId);
        return target;
    },
    async updateTargetValueForTask(taskId, value) {
        // This requires a repository method to find targets by taskId
        // For now, assume it's implemented or we skip
    },
    async recomputeProgress(goalId) {
        const targets = await goalsRepository.getTargetsForGoal(goalId);
        const progress = computeGoalProgress(targets);
        await goalsRepository.updateGoal(goalId, undefined, undefined, undefined, undefined); // Simplified
        await publish(GOAL_EVENTS.PROGRESS_UPDATED, { goalId, progress });
    }
};
//# sourceMappingURL=goals.service.js.map