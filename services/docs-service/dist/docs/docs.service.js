import { randomUUID } from 'crypto';
import { AppError, createServiceClient, publish, tier3Get, tier3Set, tier3Del } from '@clickup/sdk';
import { ErrorCode, DOC_EVENTS } from '@clickup/contracts';
import { DocsRepository } from './docs.repository.js';
export class DocsService {
    repository;
    identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001';
    constructor(repository) {
        this.repository = repository;
    }
    getIdentityClient(traceId) {
        const options = {};
        if (traceId)
            options.traceId = traceId;
        return createServiceClient(this.identityUrl, options);
    }
    async verifyMembership(workspaceId, userId, traceId) {
        const client = this.getIdentityClient(traceId);
        try {
            const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId);
            const member = response.data?.data || response.data;
            if (!member)
                throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
            return member;
        }
        catch (err) {
            if (err instanceof AppError)
                throw err;
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    }
    async createDoc(userId, input, traceId) {
        await this.verifyMembership(input.workspaceId, userId, traceId);
        let parentPath = '/' + input.workspaceId + '/';
        if (input.parentId) {
            const parent = await this.repository.getDoc(input.parentId);
            if (!parent || parent.workspace_id !== input.workspaceId) {
                throw new AppError(ErrorCode.DOC_NOT_FOUND);
            }
            parentPath = parent.path;
        }
        const docId = randomUUID();
        const path = parentPath + docId + '/';
        const doc = await this.repository.createDoc({
            id: docId,
            workspaceId: input.workspaceId,
            title: input.title || 'Untitled',
            parentId: input.parentId || null,
            path,
            createdBy: userId
        });
        await publish(DOC_EVENTS.CREATED, {
            docId: doc.id,
            workspaceId: doc.workspace_id,
            title: doc.title,
            createdBy: userId,
            occurredAt: new Date().toISOString(),
        });
        return doc;
    }
    async getDoc(userId, docId, traceId) {
        const cacheKey = 'doc:' + docId;
        const cached = await tier3Get(cacheKey);
        if (cached) {
            const doc = cached;
            await this.verifyMembership(doc.workspace_id, userId, traceId);
            return doc;
        }
        const doc = await this.repository.getDoc(docId);
        if (!doc)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        await this.verifyMembership(doc.workspace_id, userId, traceId);
        await tier3Set(cacheKey, doc);
        return doc;
    }
    async updateDocMeta(userId, docId, input, traceId) {
        const doc = await this.repository.getDoc(docId);
        if (!doc)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        await this.verifyMembership(doc.workspace_id, userId, traceId);
        // If content is being updated, snapshot current state before saving
        if (input.content !== undefined && doc.content) {
            await this.repository.createDocVersion(docId, doc.content, userId);
        }
        let updated;
        if (input.content !== undefined) {
            // Update content separately
            const { content, ...metaInput } = input;
            updated = await this.repository.updateDocContent(docId, content);
            if (metaInput.title !== undefined || metaInput.isPublic !== undefined) {
                updated = await this.repository.updateDocMeta(docId, metaInput);
            }
        }
        else {
            updated = await this.repository.updateDocMeta(docId, input);
        }
        await tier3Del('doc:' + docId);
        await publish(DOC_EVENTS.UPDATED, {
            docId: updated.id,
            workspaceId: updated.workspace_id,
            updatedBy: userId,
            occurredAt: new Date().toISOString(),
        });
        return updated;
    }
    async deleteDoc(userId, docId, traceId) {
        const doc = await this.repository.getDoc(docId);
        if (!doc)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        const member = await this.verifyMembership(doc.workspace_id, userId, traceId);
        const isOwner = doc.created_by === userId || ['owner', 'admin'].includes(member.role || member.data?.role);
        if (!isOwner)
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        await this.repository.softDeleteWithPath(doc.path);
        await tier3Del('doc:' + docId);
        await publish(DOC_EVENTS.DELETED, {
            docId: doc.id,
            workspaceId: doc.workspace_id,
            deletedBy: userId,
            occurredAt: new Date().toISOString(),
        });
    }
}
export const createDocsService = (db) => new DocsService(new DocsRepository(db));
//# sourceMappingURL=docs.service.js.map