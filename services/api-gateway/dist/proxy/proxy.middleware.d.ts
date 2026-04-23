import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type ServiceRoute } from './proxy.config.js';
/**
 * Build a proxy middleware for a given service route.
 *
 * Path reconstruction note:
 * When Express mounts this via router.use(prefix, proxy), it strips `prefix`
 * from req.url before the proxy sees it. pathRewrite therefore can't see the
 * original prefix and is a no-op.  Instead we use the proxyReq event which
 * fires just before the outbound HTTP request, and we reconstruct the correct
 * upstream path from req.originalUrl (always the full gateway-side URL).
 *
 * For most services we strip route.prefix entirely (e.g. /api/v1/tasks →
 * upstream gets /:taskId).  Identity-service routes set pathStripPrefix to
 * '/api/v1' so the upstream retains the sub-resource segment (/auth/...,
 * /users/..., /workspaces/...) that its internal router needs.
 */
export declare function buildProxy(route: ServiceRoute): RequestHandler;
export declare function notFound(_req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=proxy.middleware.d.ts.map