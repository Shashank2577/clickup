import { Router } from 'express'
import { buildServiceRoutes } from './proxy/proxy.config.js'
import { buildProxy, notFound } from './proxy/proxy.middleware.js'
import { authForward } from './middleware/auth-forward.js'
import { rateLimiter } from './middleware/rate-limiter.js'

export function buildRouter(): Router {
  const router = Router()
  const serviceRoutes = buildServiceRoutes()

  for (const route of serviceRoutes) {
    router.use(
      route.prefix,
      authForward,
      rateLimiter(route.isMutation),
      buildProxy(route),
    )
  }

  // Catch-all — no route matched
  router.use(notFound)

  return router
}
