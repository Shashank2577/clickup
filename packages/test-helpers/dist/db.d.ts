import { Pool, PoolClient } from 'pg';
export declare function getTestDb(): Pool;
export declare function closeTestDb(): Promise<void>;
export declare function withRollback<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
export declare function setupTestDb(): Promise<void>;
//# sourceMappingURL=db.d.ts.map