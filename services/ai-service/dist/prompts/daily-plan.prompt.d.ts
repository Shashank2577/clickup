import { DailyPlanInput } from '@clickup/contracts';
type FetchedTask = {
    id: string;
    title: string;
    estimatedMinutes?: number;
    status?: string;
};
export declare function buildDailyPlanPrompt(input: DailyPlanInput, tasks: FetchedTask[]): string;
export {};
//# sourceMappingURL=daily-plan.prompt.d.ts.map