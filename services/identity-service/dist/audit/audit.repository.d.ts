import { Pool } from 'pg';
export interface AuditLogRow {
    id: string;
    workspace_id: string;
    actor_id: string | null;
    resource_type: string;
    resource_id: string | null;
    action: string;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    created_at: Date;
}
export interface AuditLogFilters {
    actorId?: string;
    resourceType?: string;
    from?: string;
    to?: string;
}
export interface PaginatedAuditLog {
    data: AuditLogRow[];
    total: number;
    page: number;
    pageSize: number;
}
export declare class AuditRepository {
    private readonly db;
    constructor(db: Pool);
    getAuditLog(workspaceId: string, filters: AuditLogFilters, page: number, pageSize: number): Promise<PaginatedAuditLog>;
    logEvent(entry: {
        workspaceId: string;
        actorId: string | null;
        resourceType: string;
        resourceId?: string | null;
        action: string;
        metadata?: Record<string, unknown>;
        ipAddress?: string | null;
    }): Promise<void>;
}
//# sourceMappingURL=audit.repository.d.ts.map