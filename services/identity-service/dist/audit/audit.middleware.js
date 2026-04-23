import { AuditRepository } from './audit.repository.js';
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
export function auditLog(db, action, resourceType) {
    const repository = new AuditRepository(db);
    return (_req, res, next) => {
        // Capture the original end method
        const originalEnd = res.end.bind(res);
        res.end = function (...args) {
            // Restore immediately to avoid infinite loop
            res.end = originalEnd;
            const workspaceId = res.locals['workspaceId'] ??
                _req.params['workspaceId'] ??
                _req.body?.workspaceId ??
                null;
            const resourceId = res.locals['resourceId'] ?? null;
            const actorId = _req.auth?.userId ?? null;
            // Fire-and-forget — do not block the response
            if (workspaceId) {
                repository
                    .logEvent({
                    workspaceId,
                    actorId,
                    resourceType,
                    resourceId,
                    action,
                    ipAddress: _req.ip ?? null,
                })
                    .catch((err) => {
                    console.error('[audit] failed to log event', err);
                });
            }
            return originalEnd(...args);
        };
        next();
    };
}
//# sourceMappingURL=audit.middleware.js.map