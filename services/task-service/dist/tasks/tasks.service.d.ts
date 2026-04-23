import { Pool } from 'pg';
import { TaskPriority } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
export declare class TasksService {
    private readonly repository;
    private identityUrl;
    constructor(repository: TasksRepository);
    private getIdentityClient;
    private verifyMembership;
    createTask(userId: string, input: {
        title: string;
        listId: string;
        parentId?: string;
        priority?: TaskPriority;
        assigneeId?: string;
    }, traceId?: string): Promise<any>;
    getTask(userId: string, taskId: string, traceId?: string): Promise<any>;
    listTasks(userId: string, listId: string, page: number, pageSize: number, traceId?: string): Promise<{
        data: any[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
    }>;
    updateTask(userId: string, taskId: string, updates: any, traceId?: string): Promise<any>;
    deleteTask(userId: string, taskId: string, traceId?: string): Promise<void>;
}
export declare const createTasksService: (db: Pool) => TasksService;
//# sourceMappingURL=tasks.service.d.ts.map