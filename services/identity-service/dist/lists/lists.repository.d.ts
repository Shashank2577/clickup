import { Pool } from 'pg';
export interface ListRow {
    id: string;
    space_id: string;
    folder_id: string | null;
    name: string;
    color: string | null;
    position: number;
    is_archived: boolean;
    created_by: string;
    deleted_at: Date | null;
}
export declare class ListsRepository {
    private readonly db;
    constructor(db: Pool);
    createList(input: {
        spaceId: string;
        name: string;
        color?: string | null;
        createdBy: string;
        position: number;
    }): Promise<ListRow>;
    createListInFolder(input: {
        spaceId: string;
        folderId: string;
        name: string;
        color?: string | null;
        createdBy: string;
        position: number;
    }): Promise<ListRow>;
    getListsByFolder(folderId: string): Promise<ListRow[]>;
    seedDefaultStatuses(listId: string): Promise<void>;
    getList(id: string): Promise<(ListRow & {
        workspace_id: string;
    }) | null>;
    getListsBySpace(spaceId: string): Promise<ListRow[]>;
    updateList(id: string, input: {
        name?: string;
        color?: string | null;
        isArchived?: boolean;
    }): Promise<ListRow>;
    softDeleteList(id: string): Promise<void>;
    getMaxPosition(spaceId: string): Promise<number>;
    getSpaceWithWorkspace(spaceId: string): Promise<{
        workspace_id: string;
        id: string;
    } | null>;
    getWorkspaceMember(workspaceId: string, userId: string): Promise<{
        role: string;
    } | null>;
}
//# sourceMappingURL=lists.repository.d.ts.map