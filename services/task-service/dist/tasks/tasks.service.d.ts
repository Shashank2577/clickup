import { Task, CreateTaskInput, UpdateTaskInput } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
export declare class TasksService {
    private readonly repo;
    private readonly identityClient;
    constructor(repo: TasksRepository);
    createTask(input: CreateTaskInput, userId: string): Promise<Task>;
    getTask(id: string, userId: string): Promise<Task>;
    updateTask(id: string, input: UpdateTaskInput, userId: string): Promise<Task>;
    deleteTask(id: string, userId: string): Promise<void>;
    private getList;
    private assertWorkspaceMember;
}
//# sourceMappingURL=tasks.service.d.ts.map