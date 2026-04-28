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
    const requestState = await getClerk().authenticateRequest(req as any)

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
