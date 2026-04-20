import { Pool, PoolClient } from 'pg';
export interface SpaceRow {
    id: string;
    workspace_id: string;
    name: string;
    color: string | null;
    icon: string | null;
    is_private: boolean;
    position: number;
    created_by: string;
    deleted_at: Date | null;
}
export declare class SpacesRepository {
    private readonly db;
    constructor(db: Pool);
    createSpace(input: {
        workspaceId: string;
        name: string;
        color?: string | null;
        icon?: string | null;
        isPrivate?: boolean;
        createdBy: string;
        position: number;
    }): Promise<SpaceRow>;
    getSpace(id: string): Promise<SpaceRow | null>;
    getSpacesByWorkspace(workspaceId: string, userId: string): Promise<SpaceRow[]>;
    updateSpace(id: string, input: {
        name?: string;
        color?: string | null;
        icon?: string | null;
    }): Promise<SpaceRow>;
    softDeleteSpace(id: string, client?: PoolClient): Promise<void>;
    softDeleteListsBySpace(spaceId: string, client?: PoolClient): Promise<void>;
    getMaxPosition(workspaceId: string): Promise<number>;
    getWorkspaceMember(workspaceId: string, userId: string): Promise<{
        role: string;
    } | null>;
}
//# sourceMappingURL=spaces.repository.d.ts.map