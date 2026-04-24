import { Pool } from 'pg';
export declare class DocsRepository {
    private readonly db;
    constructor(db: Pool);
    createDoc(record: {
        id: string;
        workspaceId: string;
        title: string;
        parentId: string | null;
        path: string;
        createdBy: string;
    }): Promise<any>;
    getDoc(id: string): Promise<any | null>;
    updateDocMeta(id: string, input: {
        title?: string;
        isPublic?: boolean;
    }): Promise<any>;
    softDeleteWithPath(path: string): Promise<void>;
    getLatestSnapshot(docId: string): Promise<{
        stateVector: Buffer;
        updateData: Buffer;
    } | null>;
    saveSnapshot(docId: string, stateVector: Uint8Array, updateData: Uint8Array): Promise<void>;
    isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean>;
    updateDocContent(id: string, content: Record<string, unknown>): Promise<any>;
    listDocPermissions(docId: string): Promise<any[]>;
    getDocPermissionForUser(docId: string, userId: string): Promise<any | null>;
    grantDocPermission(docId: string, userId: string, role: 'viewer' | 'commenter' | 'editor'): Promise<any>;
    revokeDocPermission(docId: string, userId: string): Promise<boolean>;
    getShareLink(docId: string): Promise<any | null>;
    getShareLinkByToken(token: string): Promise<any | null>;
    upsertShareLink(docId: string, role: 'viewer' | 'commenter', expiresAt?: string): Promise<any>;
    deleteShareLink(docId: string): Promise<boolean>;
    createDocVersion(docId: string, content: Record<string, unknown>, createdBy: string): Promise<any>;
    listDocVersions(docId: string): Promise<any[]>;
    getDocVersion(docId: string, versionId: string): Promise<any | null>;
    restoreDocVersion(docId: string, versionId: string, restoredBy: string): Promise<any | null>;
}
export declare const createDocsRepository: (db: Pool) => DocsRepository;
//# sourceMappingURL=docs.repository.d.ts.map