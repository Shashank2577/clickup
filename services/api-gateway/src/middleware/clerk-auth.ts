import { createClerkClient } from '@clerk/backend'
import type { Request, Response, NextFunction } from 'express'

// Defer clerk client creation so tests can mock @clerk/backend before this runs
let _clerk: ReturnType<typeof createClerkClient> | undefined

function getClerk(): ReturnType<typeof createClerkClient> {
  if (!_clerk) {
    const secretKey = process.env['CLERK_SECRET_KEY']
    if (!secretKey) throw new Error('CLERK_SECRET_KEY env var is required')
    _clerk = createClerkClient({
      secretKey,
      publishableKey: process.env['CLERK_PUBLISHABLE_KEY'],
    })
  }
  return _clerk
}

export async function clerkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Express strips the route prefix from req.url (e.g. /workspaces/me → /me).
    // Clerk's SDK needs an absolute URL to parse. Build one from req.originalUrl.
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'http'
    const host = (req.headers['host'] as string) || 'localhost:3333'
    const fullUrl = `${protocol}://${host}${req.originalUrl}`
    const syntheticReq = new globalThis.Request(fullUrl, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      ),
    })
    const requestState = await getClerk().authenticateRequest(syntheticReq)

    if (!requestState.isSignedIn) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const auth = requestState.toAuth()
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    req.headers['x-user-id'] = auth.userId
    if (auth.orgId) req.headers['x-org-id'] = auth.orgId
    if (auth.sessionId) req.headers['x-session-id'] = auth.sessionId
    next()
  } catch (err) {
    next(err)
  }
}
