import type { Pool, PoolClient } from 'pg';
export interface TestUser {
    id: string;
    email: string;
    name: string;
    password: string;
}
export declare function createTestUser(db: Pool | PoolClient, override?: Partial<{
    email: string;
    name: string;
    password: string;
}>): Promise<TestUser>;
//# sourceMappingURL=users.fixture.d.ts.map