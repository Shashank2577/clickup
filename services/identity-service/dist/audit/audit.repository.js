export class AuditRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getAuditLog(workspaceId, filters, page, pageSize) {
        const conditions = ['workspace_id = $1'];
        const params = [workspaceId];
        let paramIdx = 2;
        if (filters.actorId) {
            conditions.push(`actor_id = $${paramIdx++}`);
            params.push(filters.actorId);
        }
        if (filters.resourceType) {
            conditions.push(`resource_type = $${paramIdx++}`);
            params.push(filters.resourceType);
        }
        if (filters.from) {
            conditions.push(`created_at >= $${paramIdx++}`);
            params.push(filters.from);
        }
        if (filters.to) {
            conditions.push(`created_at <= $${paramIdx++}`);
            params.push(filters.to);
        }
        const where = conditions.join(' AND ');
        const offset = (page - 1) * pageSize;
        const countResult = await this.db.query(`SELECT COUNT(*) AS count FROM audit_logs WHERE ${where}`, params);
        const total = parseInt(countResult.rows[0].count, 10);
        const dataResult = await this.db.query(`SELECT * FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`, [...params, pageSize, offset]);
        return { data: dataResult.rows, total, page, pageSize };
    }
    async logEvent(entry) {
        await this.db.query(`INSERT INTO audit_logs (workspace_id, actor_id, resource_type, resource_id, action, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            entry.workspaceId,
            entry.actorId ?? null,
            entry.resourceType,
            entry.resourceId ?? null,
            entry.action,
            JSON.stringify(entry.metadata ?? {}),
            entry.ipAddress ?? null,
        ]);
    }
}
//# sourceMappingURL=audit.repository.js.map