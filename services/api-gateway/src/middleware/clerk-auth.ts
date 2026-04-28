import { createClerkClient } from '@clerk/backend'
import type { Request, Response, NextFunction } from 'express'

const clerk = createClerkClient({
  secretKey: process.env['CLERK_SECRET_KEY'],
  publishableKey: process.env['CLERK_PUBLISHABLE_KEY'],
})

export async function clerkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestState = await clerk.authenticateRequest(req as any, {
      secretKey: process.env['CLERK_SECRET_KEY'],
      publishableKey: process.env['CLERK_PUBLISHABLE_KEY'],
    })

    if (!requestState.isSignedIn) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const auth = requestState.toAuth()!
    req.headers['x-user-id'] = auth.userId
    if (auth.orgId) req.headers['x-org-id'] = auth.orgId
    if (auth.sessionId) req.headers['x-session-id'] = auth.sessionId
    next()
  } catch (err) {
    next(err)
  }
}
