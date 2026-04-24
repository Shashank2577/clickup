import { createHash } from 'crypto';
import { requireAuth } from '@clickup/sdk';
import { db } from '../db.js';
/**
 * Strip client-supplied X-User-* headers to prevent header injection, then
 * verify JWT (or API key) and forward decoded claims to upstream services.
 *
 * Auth priority:
 *   1. Bearer cu_... token → SHA-256 lookup against api_keys table
 *   2. Bearer eyJ... (JWT) → standard requireAuth verification
 *
 * Public routes skip verification but X-User-* headers are always stripped
 * so upstream services can trust that any X-User-* header came from the gateway.
 */
const PUBLIC_PREFIXES = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/verify-email',
    '/api/v1/auth/resend-verification',
    '/api/v1/auth/google',
    '/api/v1/auth/github',
    '/api/v1/auth/guest',
    '/api/v1/forms/submit/', // public form submissions
    '/api/v1/tasks/share/', // public task share-link reads (GET only)
    '/api/v1/docs/shared/', // public doc share-link reads
    '/health',
];
const INTERNAL_HEADERS = ['x-user-id', 'x-user-role', 'x-workspace-id', 'x-session-id', 'x-api-key-id', 'x-api-key-scopes'];
function isPublic(path, method) {
    if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || path.endsWith('/health')) {
        return true;
    }
    // Task share token reads are public GET-only
    if (method === 'GET' && path.includes('/tasks/share/'))
        return true;
    return false;
}
function extractBearerToken(req) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
/**
 * Validate an API key (cu_ prefix) against the api_keys table.
 * Returns null if invalid or expired.
 */
async function validateApiKey(raw) {
    const hash = createHash('sha256').update(raw).digest('hex');
    const { rows } = await db.query(`SELECT id, user_id, workspace_id, scopes
     FROM api_keys
     WHERE key_hash = $1
       AND (expires_at IS NULL OR expires_at > NOW())`, [hash]);
    if (!rows[0])
        return null;
    // Fire-and-forget last_used_at update — never block the request on this
    db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {
        // intentionally ignored — a failed timestamp update must never fail the API call
    });
    return {
        keyId: rows[0].id,
        userId: rows[0].user_id,
        workspaceId: rows[0].workspace_id,
        scopes: rows[0].scopes ?? [],
    };
}
export function authForward(req, res, next) {
    // Always strip client-supplied internal headers (prevents header injection)
    for (const header of INTERNAL_HEADERS) {
        delete req.headers[header];
    }
    const path = req.originalUrl || req.url;
    if (isPublic(path, req.method)) {
        next();
        return;
    }
    const token = extractBearerToken(req);
    // ── API key path (cu_ prefix) ──────────────────────────────────────────────
    if (token?.startsWith('cu_')) {
        validateApiKey(token)
            .then((info) => {
            if (!info) {
                res.status(401).json({ error: 'API key invalid or expired' });
                return;
            }
            req.headers['x-user-id'] = info.userId;
            req.headers['x-workspace-id'] = info.workspaceId;
            req.headers['x-api-key-id'] = info.keyId;
            req.headers['x-api-key-scopes'] = info.scopes.join(',');
            // role defaults to 'member' for API key requests — upstream can override if needed
            req.headers['x-user-role'] = 'member';
            next();
        })
            .catch((err) => {
            next(err);
        });
        return;
    }
    // ── JWT path ───────────────────────────────────────────────────────────────
    // requireAuth verifies JWT, sets req.auth, and calls next(AppError) on failure
    requireAuth(req, res, (err) => {
        if (err) {
            next(err);
            return;
        }
        // Forward verified claims to upstream services
        req.headers['x-user-id'] = req.auth.userId;
        req.headers['x-user-role'] = req.auth.role;
        req.headers['x-workspace-id'] = req.auth.workspaceId;
        req.headers['x-session-id'] = req.auth.sessionId;
        next();
    });
}
//# sourceMappingURL=auth-forward.js.map