import { RequestHandler } from 'express';
import { Pool } from 'pg';
/**
 * Middleware factory that logs an audit event AFTER a route handler completes.
 *
 * Usage:
 *   router.post('/some-route', requireAuth, handler, auditLog(db, 'member.added', 'workspace_member'))
 *
 * Reads:
 *   - req.auth.userId        → actor_id
 *   - res.locals.workspaceId → workspace_id (fallback: req.params.workspaceId)
 *   - res.locals.resourceId  → resource_id
 *   - req.ip                 → ip_address
 */
export declare function auditLog(db: Pool, action: string, resourceType: string): RequestHandler;
//# sourceMappingURL=audit.middleware.d.ts.map