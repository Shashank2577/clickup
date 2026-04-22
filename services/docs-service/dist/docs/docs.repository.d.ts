import type { Pool, PoolClient } from 'pg';
import type { Doc } from '@clickup/contracts';
export interface DocWithChildCount extends Doc {
    childCount: number;
}
export declare class DocsRepository {
    private readonly db;
    constructor(db: Pool);
    findById(id: string, client?: PoolClient): Promise<Doc | null>;
    listTopLevel(workspaceId: string): Promise<DocWithChildCount[]>;
    listChildren(parentId: string): Promise<DocWithChildCount[]>;
    listDescendants(path: string, docId: string): Promise<Doc[]>;
    create(input: {
        id: string;
        workspaceId: string;
        title: string;
        content: Record<string, unknown>;
        parentId: string | null;
        path: string;
        isPublic: boolean;
        createdBy: string;
    }, client?: PoolClient): Promise<Doc>;
    update(id: string, input: {
        title?: string;
        content?: Record<string, unknown>;
        isPublic?: boolean;
    }): Promise<Doc | null>;
    softDeleteWithDescendants(id: string, path: string): Promise<string[]>;
}
//# sourceMappingURL=docs.repository.d.ts.map