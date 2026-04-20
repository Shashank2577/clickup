import { Pool, PoolClient } from 'pg';
interface WorkspaceRow {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    logo_url: string | null;
    created_at: Date;
}
interface MemberRow {
    workspace_id: string;
    user_id: string;
    role: string;
    joined_at: Date;
}
export declare class WorkspacesRepository {
    private readonly db;
    constructor(db: Pool);
    getWorkspaceBySlug(slug: string): Promise<WorkspaceRow | null>;
    createWorkspace(client: PoolClient, input: {
        name: string;
        slug: string;
        ownerId: string;
    }): Promise<WorkspaceRow>;
    addMember(client: PoolClient | Pool, input: {
        workspaceId: string;
        userId: string;
        role: string;
    }): Promise<MemberRow>;
    getWorkspace(id: string): Promise<WorkspaceRow | null>;
    getUserWorkspaces(userId: string): Promise<Array<WorkspaceRow & {
        role: string;
        joined_at: Date;
    }>>;
    updateWorkspace(id: string, input: {
        name?: string;
        logoUrl?: string | null;
    }): Promise<WorkspaceRow>;
    getMember(workspaceId: string, userId: string): Promise<MemberRow | null>;
    getMembers(workspaceId: string): Promise<MemberRow[]>;
    removeMember(workspaceId: string, userId: string): Promise<void>;
    updateMemberRole(workspaceId: string, userId: string, role: string): Promise<void>;
    getUserByEmail(email: string): Promise<{
        id: string;
        email: string;
    } | null>;
}
export {};
//# sourceMappingURL=workspaces.repository.d.ts.map