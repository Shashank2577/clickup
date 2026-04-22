import { Pool, PoolClient } from 'pg';
import { Task, TaskWithRelations } from '@clickup/contracts';
export declare class TasksRepository {
    private readonly db;
    constructor(db: Pool);
    findById(id: string): Promise<TaskWithRelations | null>;
    listByList(listId: string, limit: number, offset: number): Promise<Task[]>;
    create(input: any, tx?: PoolClient): Promise<Task>;
    update(id: string, input: any): Promise<Task | null>;
    softDelete(id: string, path: string): Promise<string[]>;
    getMaxPosition(listId: string, parentId: string | null): Promise<number>;
    private mapRowToTask;
}
//# sourceMappingURL=tasks.repository.d.ts.map