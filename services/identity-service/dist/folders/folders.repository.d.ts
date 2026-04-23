import { Pool } from 'pg';
export interface FolderRow {
    id: string;
    space_id: string;
    name: string;
    color: string | null;
    position: number;
    is_private: boolean;
    created_by: string;
    created_at: Date;
    updated_at: Date;
}
export interface FolderWithLists extends FolderRow {
    lists: {
        id: string;
        name: string;
        color: string | null;
        position: number;
        is_archived: boolean;
        folder_id: string;
    }[];
}
export declare class FoldersRepository {
    private readonly db;
    constructor(db: Pool);
    createFolder(input: {
        spaceId: string;
        name: string;
        color?: string | null;
        isPrivate?: boolean;
        createdBy: string;
        position: number;
    }): Promise<FolderRow>;
    getFolder(id: string): Promise<FolderRow | null>;
    getFoldersWithListsBySpace(spaceId: string): Promise<FolderWithLists[]>;
    updateFolder(id: string, input: {
        name?: string;
        color?: string | null;
    }): Promise<FolderRow>;
    deleteFolder(id: string): Promise<void>;
    getMaxPosition(spaceId: string): Promise<number>;
    getSpaceWithWorkspace(spaceId: string): Promise<{
        id: string;
        workspace_id: string;
    } | null>;
    getWorkspaceMember(workspaceId: string, userId: string): Promise<{
        role: string;
    } | null>;
    /** Used by lists handler to create a list inside a folder */
    getFolderWithSpace(folderId: string): Promise<{
        id: string;
        space_id: string;
        workspace_id: string;
    } | null>;
}
//# sourceMappingURL=folders.repository.d.ts.map