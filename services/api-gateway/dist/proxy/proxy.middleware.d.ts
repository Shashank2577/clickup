import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type ServiceRoute } from './proxy.config.js';
/**
 * Build a proxy middleware for a given service route.
 * Strips the route prefix before forwarding so the upstream service
 * receives its own path without the gateway prefix.
 */
export declare function buildProxy(route: ServiceRoute): RequestHandler;
export declare function notFound(_req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=proxy.middleware.d.ts.map