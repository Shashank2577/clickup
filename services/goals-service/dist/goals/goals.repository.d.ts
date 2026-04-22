import { Pool } from 'pg';
export declare const db: Pool;
export declare const goalsRepository: {
    getGoal(goalId: string): Promise<any>;
    getGoalsForWorkspace(workspaceId: string): Promise<any[]>;
    createGoal(workspaceId: string, name: string, description: string | undefined | null, dueDate: string | undefined | null, ownerId: string, color: string | undefined | null): Promise<any>;
    updateGoal(goalId: string, name?: string, description?: string, dueDate?: string, color?: string): Promise<any>;
    deleteGoal(goalId: string): Promise<void>;
    getTargetsForGoal(goalId: string): Promise<any[]>;
    getTarget(targetId: string, goalId: string): Promise<any>;
    createTarget(goalId: string, name: string, type: string, targetValue?: number, currentValue?: number, taskId?: string): Promise<any>;
    updateTarget(targetId: string, goalId: string, name?: string, currentValue?: number, targetValue?: number, taskId?: string): Promise<any>;
    getTaskWithWorkspace(taskId: string): Promise<{
        workspaceId: string;
    } | null>;
};
//# sourceMappingURL=goals.repository.d.ts.map