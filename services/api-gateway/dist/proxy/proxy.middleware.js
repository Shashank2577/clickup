import { createProxyMiddleware } from 'http-proxy-middleware';
/**
 * Build a proxy middleware for a given service route.
 * Strips the route prefix before forwarding so the upstream service
 * receives its own path without the gateway prefix.
 */
export function buildProxy(route) {
    return createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        // Remove the gateway prefix from the path so upstream services
        // don't need to know they're behind a gateway
        pathRewrite: { [`^${route.prefix}`]: '' },
        on: {
            error: (err, _req, res) => {
                // Upstream service unavailable — return 503
                const response = res;
                if (!response.headersSent) {
                    response.status(503).json({
                        error: 'SERVICE_UNAVAILABLE',
                        message: 'Upstream service is temporarily unavailable',
                    });
                }
            },
        },
    });
}
export function notFound(_req, res, _next) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'No upstream service matched this route' });
}
//# sourceMappingURL=proxy.middleware.js.map