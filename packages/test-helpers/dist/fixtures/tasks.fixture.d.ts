import type { Pool, PoolClient } from 'pg';
export interface TestTask {
    id: string;
    path: string;
    seqId: number;
}
export interface TestComment {
    id: string;
}
export declare function createTestTask(db: Pool | PoolClient, listId: string, createdBy: string, override?: Partial<{
    title: string;
    priority: string;
    parentPath: string;
}>): Promise<TestTask>;
export declare function createTestComment(db: Pool | PoolClient, taskId: string, authorId: string, body?: string): Promise<TestComment>;
//# sourceMappingURL=tasks.fixture.d.ts.map