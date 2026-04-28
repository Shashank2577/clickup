import { createProxyMiddleware } from 'http-proxy-middleware'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { type ServiceRoute } from './proxy.config.js'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
export function buildProxy(route: ServiceRoute): RequestHandler {
  const stripPrefix = route.pathStripPrefix ?? route.prefix
  const stripRe = new RegExp('^' + escapeRegex(stripPrefix))

  return createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        // Fix path
        const originalUrl: string = req.originalUrl || req.url
        const qIdx = originalUrl.indexOf('?')
        const pathname = qIdx >= 0 ? originalUrl.slice(0, qIdx) : originalUrl
        const query = qIdx >= 0 ? originalUrl.slice(qIdx) : ''
        const rewritten = pathname.replace(stripRe, '') || '/'
        proxyReq.path = rewritten + query

        // Forward auth and user headers explicitly
        if (req.headers['authorization']) {
          proxyReq.setHeader('Authorization', req.headers['authorization'])
        }
        for (const h of ['x-user-id', 'x-user-role', 'x-workspace-id', 'x-session-id', 'x-trace-id']) {
          if (req.headers[h]) proxyReq.setHeader(h, req.headers[h] as string)
        }

        // Re-serialize body if express.json() already parsed it
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body)
          proxyReq.setHeader('Content-Type', 'application/json')
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
          proxyReq.write(bodyData)
        }
      },
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
