export declare function computeGoalProgress(targets: any[]): number;
export declare function computeTargetProgress(target: any): number;
export declare const goalsService: {
    verifyWorkspaceMembership(workspaceId: string, userId: string, traceId: string): Promise<void>;
    createGoal(workspaceId: string, name: string, description: string | null, dueDate: string | null, color: string | null, userId: string, traceId: string): Promise<any>;
    getGoal(goalId: string, userId: string, traceId: string): Promise<any>;
    getGoalsForWorkspace(workspaceId: string, userId: string, traceId: string): Promise<any[]>;
    updateGoal(goalId: string, input: any, userId: string, traceId: string): Promise<any>;
    deleteGoal(goalId: string, userId: string, traceId: string): Promise<void>;
    addTarget(goalId: string, input: any, userId: string, traceId: string): Promise<any>;
    updateTarget(goalId: string, targetId: string, input: any, userId: string, traceId: string): Promise<any>;
    updateTargetValueForTask(taskId: string, value: number): Promise<void>;
    recomputeProgress(goalId: string): Promise<void>;
};
//# sourceMappingURL=goals.service.d.ts.map