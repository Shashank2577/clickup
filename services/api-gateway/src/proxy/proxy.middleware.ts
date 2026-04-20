import { createProxyMiddleware } from 'http-proxy-middleware'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { type ServiceRoute } from './proxy.config.js'

/**
 * Build a proxy middleware for a given service route.
 * Strips the route prefix before forwarding so the upstream service
 * receives its own path without the gateway prefix.
 */
export function buildProxy(route: ServiceRoute): RequestHandler {
  return createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    // Remove the gateway prefix from the path so upstream services
    // don't need to know they're behind a gateway
    pathRewrite: { [`^${route.prefix}`]: '' },
    on: {
      error: (err: Error, _req: Request, res: any) => {
        // Upstream service unavailable — return 503
        const response = res as Response
        if (!response.headersSent) {
          response.status(503).json({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Upstream service is temporarily unavailable',
          })
        }
      },
    },
  }) as unknown as RequestHandler
}

export function notFound(_req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({ error: 'NOT_FOUND', message: 'No upstream service matched this route' })
}
