import * as Q from './docs.queries.js';
// ============================================================
// DocsRepository — thin layer over SQL, no business logic
// ============================================================
export class DocsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id, client) {
        const executor = client ?? this.db;
        const result = await executor.query(Q.FIND_BY_ID, [id]);
        return result.rows[0] ?? null;
    }
    async listTopLevel(workspaceId) {
        const result = await this.db.query(Q.LIST_TOP_LEVEL, [workspaceId]);
        return result.rows;
    }
    async listChildren(parentId) {
        const result = await this.db.query(Q.LIST_CHILDREN, [parentId]);
        return result.rows;
    }
    async listDescendants(path, docId) {
        const result = await this.db.query(Q.LIST_DESCENDANTS, [path, docId]);
        return result.rows;
    }
    async create(input, client) {
        const executor = client ?? this.db;
        const result = await executor.query(Q.INSERT, [
            input.id,
            input.workspaceId,
            input.title,
            JSON.stringify(input.content),
            input.parentId,
            input.path,
            input.isPublic,
            input.createdBy,
        ]);
        if (!result.rows[0]) {
            throw new Error('Failed to insert doc');
        }
        return result.rows[0];
    }
    async update(id, input) {
        const result = await this.db.query(Q.UPDATE, [
            id,
            input.title ?? null,
            input.content !== undefined ? JSON.stringify(input.content) : null,
            input.isPublic ?? null,
        ]);
        return result.rows[0] ?? null;
    }
    async softDeleteWithDescendants(id, path) {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');
            // Delete the doc itself
            const rootResult = await client.query(Q.SOFT_DELETE, [id]);
            // Delete descendants by path prefix
            const descResult = await client.query(Q.SOFT_DELETE_DESCENDANTS, [path, id]);
            await client.query('COMMIT');
            const deletedIds = [
                ...rootResult.rows.map((r) => r.id),
                ...descResult.rows.map((r) => r.id),
            ];
            return deletedIds;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
}
//# sourceMappingURL=docs.repository.js.map