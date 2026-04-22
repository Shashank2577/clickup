import type { Doc } from '@clickup/contracts';
import type { DocsRepository, DocWithChildCount } from './docs.repository.js';
export declare class DocsService {
    private readonly repository;
    constructor(repository: DocsRepository);
    private assertWorkspaceMember;
    createDoc(input: {
        workspaceId: string;
        title?: string;
        content?: Record<string, unknown>;
        parentId?: string;
        isPublic?: boolean;
        userId: string;
        token: string;
    }): Promise<Doc>;
    listDocs(input: {
        workspaceId: string;
        userId: string;
        token: string;
    }): Promise<DocWithChildCount[]>;
    getDoc(input: {
        docId: string;
        userId: string;
        token: string;
    }): Promise<{
        doc: Doc;
        children: DocWithChildCount[];
    }>;
    updateDoc(input: {
        docId: string;
        title?: string;
        content?: Record<string, unknown>;
        isPublic?: boolean;
        userId: string;
        token: string;
    }): Promise<Doc>;
    deleteDoc(input: {
        docId: string;
        userId: string;
        token: string;
    }): Promise<void>;
    listPages(input: {
        docId: string;
        userId: string;
        token: string;
    }): Promise<DocWithChildCount[]>;
    createPage(input: {
        parentDocId: string;
        title?: string;
        content?: Record<string, unknown>;
        isPublic?: boolean;
        userId: string;
        token: string;
    }): Promise<Doc>;
}
//# sourceMappingURL=docs.service.d.ts.map