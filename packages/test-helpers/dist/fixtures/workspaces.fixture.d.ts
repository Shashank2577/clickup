import type { Pool, PoolClient } from 'pg';
export interface TestWorkspace {
    id: string;
    slug: string;
    name: string;
}
export interface TestSpace {
    id: string;
}
export interface TestList {
    id: string;
}
export declare function createTestWorkspace(db: Pool | PoolClient, ownerId: string): Promise<TestWorkspace>;
export declare function createTestSpace(db: Pool | PoolClient, workspaceId: string, createdBy: string): Promise<TestSpace>;
export declare function createTestList(db: Pool | PoolClient, spaceId: string, createdBy: string): Promise<TestList>;
//# sourceMappingURL=workspaces.fixture.d.ts.map