import { Pool } from 'pg';
import { DocsRepository } from './docs.repository.js';
export declare class DocsService {
    private readonly repository;
    private identityUrl;
    constructor(repository: DocsRepository);
    private getIdentityClient;
    private verifyMembership;
    createDoc(userId: string, input: {
        title?: string;
        workspaceId: string;
        parentId?: string;
    }, traceId?: string): Promise<any>;
    getDoc(userId: string, docId: string, traceId?: string): Promise<any>;
    updateDocMeta(userId: string, docId: string, input: {
        title?: string;
        isPublic?: boolean;
        content?: Record<string, unknown>;
    }, traceId?: string): Promise<any>;
    deleteDoc(userId: string, docId: string, traceId?: string): Promise<void>;
}
export declare const createDocsService: (db: Pool) => DocsService;
//# sourceMappingURL=docs.service.d.ts.map