import { randomUUID } from 'crypto';
import { ErrorCode, DOC_EVENTS } from '@clickup/contracts';
import { AppError, logger, publish, createServiceClient, tier2Get, tier2Set, tier2Del, CacheKeys, } from '@clickup/sdk';
const IDENTITY_SERVICE_URL = process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001';
// Cast DOC_EVENTS values to EventSubject since ALL_EVENTS spread loses
// the doc.* literals due to key name collisions with other event domains.
const DOC_CREATED = DOC_EVENTS.CREATED;
const DOC_UPDATED = DOC_EVENTS.UPDATED;
const DOC_DELETED = DOC_EVENTS.DELETED;
// ============================================================
// Helper: strip undefined values from an object so we can pass
// it where exactOptionalPropertyTypes is enabled.
// ============================================================
function stripUndefined(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}
// ============================================================
// DocsService — business logic for the docs domain
// ============================================================
export class DocsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    // ----------------------------------------------------------
    // Workspace membership check via identity-service
    // ----------------------------------------------------------
    async assertWorkspaceMember(workspaceId, userId, token) {
        const client = createServiceClient(IDENTITY_SERVICE_URL);
        try {
            await client.get(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
        }
        catch {
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    }
    // ----------------------------------------------------------
    // Create a doc (root-level or with parent)
    // Path format:
    //   root:   /{workspaceId}/{docId}/
    //   nested: {parentPath}{docId}/
    // ----------------------------------------------------------
    async createDoc(input) {
        await this.assertWorkspaceMember(input.workspaceId, input.userId, input.token);
        let parentPath = null;
        if (input.parentId) {
            const parent = await this.repository.findById(input.parentId);
            if (!parent) {
                throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Parent doc not found');
            }
            parentPath = parent.path;
        }
        const docId = randomUUID();
        const path = parentPath
            ? `${parentPath}${docId}/`
            : `/${input.workspaceId}/${docId}/`;
        const doc = await this.repository.create({
            id: docId,
            workspaceId: input.workspaceId,
            title: input.title ?? 'Untitled',
            content: input.content ?? {},
            parentId: input.parentId ?? null,
            path,
            isPublic: input.isPublic ?? false,
            createdBy: input.userId,
        });
        // Invalidate list cache
        await tier2Del(CacheKeys.docList(input.workspaceId));
        // Publish event AFTER DB write
        const event = {
            docId: doc.id,
            workspaceId: doc.workspaceId,
            title: doc.title,
            parentId: doc.parentId,
            createdBy: input.userId,
            isPublic: doc.isPublic,
            occurredAt: new Date().toISOString(),
        };
        await publish(DOC_CREATED, event);
        logger.info({ docId: doc.id, workspaceId: doc.workspaceId }, 'Doc created');
        return doc;
    }
    // ----------------------------------------------------------
    // List top-level docs in a workspace
    // ----------------------------------------------------------
    async listDocs(input) {
        await this.assertWorkspaceMember(input.workspaceId, input.userId, input.token);
        const cacheKey = CacheKeys.docList(input.workspaceId);
        const cached = await tier2Get(cacheKey);
        if (cached)
            return cached;
        const docs = await this.repository.listTopLevel(input.workspaceId);
        await tier2Set(cacheKey, docs);
        return docs;
    }
    // ----------------------------------------------------------
    // Get a single doc with its immediate children
    // ----------------------------------------------------------
    async getDoc(input) {
        const doc = await this.repository.findById(input.docId);
        if (!doc)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        // Public docs don't require membership check
        if (!doc.isPublic) {
            await this.assertWorkspaceMember(doc.workspaceId, input.userId, input.token);
        }
        const children = await this.repository.listChildren(input.docId);
        return { doc, children };
    }
    // ----------------------------------------------------------
    // Update a doc
    // ----------------------------------------------------------
    async updateDoc(input) {
        const existing = await this.repository.findById(input.docId);
        if (!existing)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        await this.assertWorkspaceMember(existing.workspaceId, input.userId, input.token);
        const updateFields = stripUndefined({
            title: input.title,
            content: input.content,
            isPublic: input.isPublic,
        });
        const updated = await this.repository.update(input.docId, updateFields);
        if (!updated)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        // Invalidate caches
        await tier2Del(CacheKeys.doc(input.docId));
        await tier2Del(CacheKeys.docList(existing.workspaceId));
        // Publish event AFTER DB write
        const event = {
            docId: updated.id,
            workspaceId: updated.workspaceId,
            title: updated.title,
            isPublic: updated.isPublic,
            updatedBy: input.userId,
            occurredAt: new Date().toISOString(),
        };
        await publish(DOC_UPDATED, event);
        logger.info({ docId: updated.id }, 'Doc updated');
        return updated;
    }
    // ----------------------------------------------------------
    // Soft-delete a doc and all its descendants
    // ----------------------------------------------------------
    async deleteDoc(input) {
        const existing = await this.repository.findById(input.docId);
        if (!existing)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        await this.assertWorkspaceMember(existing.workspaceId, input.userId, input.token);
        const deletedIds = await this.repository.softDeleteWithDescendants(existing.id, existing.path);
        // Invalidate caches
        await tier2Del(CacheKeys.doc(input.docId));
        await tier2Del(CacheKeys.docList(existing.workspaceId));
        // Publish event AFTER DB write
        const event = {
            docId: existing.id,
            workspaceId: existing.workspaceId,
            deletedIds,
            deletedBy: input.userId,
            occurredAt: new Date().toISOString(),
        };
        await publish(DOC_DELETED, event);
        logger.info({ docId: existing.id, deletedCount: deletedIds.length }, 'Doc deleted');
    }
    // ----------------------------------------------------------
    // List immediate child pages of a doc
    // ----------------------------------------------------------
    async listPages(input) {
        const doc = await this.repository.findById(input.docId);
        if (!doc)
            throw new AppError(ErrorCode.DOC_NOT_FOUND);
        if (!doc.isPublic) {
            await this.assertWorkspaceMember(doc.workspaceId, input.userId, input.token);
        }
        return this.repository.listChildren(input.docId);
    }
    // ----------------------------------------------------------
    // Create a nested page under a parent doc
    // ----------------------------------------------------------
    async createPage(input) {
        const parent = await this.repository.findById(input.parentDocId);
        if (!parent)
            throw new AppError(ErrorCode.DOC_NOT_FOUND, 'Parent doc not found');
        await this.assertWorkspaceMember(parent.workspaceId, input.userId, input.token);
        const docId = randomUUID();
        const path = `${parent.path}${docId}/`;
        const doc = await this.repository.create({
            id: docId,
            workspaceId: parent.workspaceId,
            title: input.title ?? 'Untitled',
            content: input.content ?? {},
            parentId: parent.id,
            path,
            isPublic: input.isPublic ?? false,
            createdBy: input.userId,
        });
        // Invalidate caches
        await tier2Del(CacheKeys.doc(parent.id));
        await tier2Del(CacheKeys.docList(parent.workspaceId));
        // Publish event AFTER DB write
        const event = {
            docId: doc.id,
            workspaceId: doc.workspaceId,
            title: doc.title,
            parentId: doc.parentId,
            createdBy: input.userId,
            isPublic: doc.isPublic,
            occurredAt: new Date().toISOString(),
        };
        await publish(DOC_CREATED, event);
        logger.info({ docId: doc.id, parentId: parent.id }, 'Page created');
        return doc;
    }
}
//# sourceMappingURL=docs.service.js.map