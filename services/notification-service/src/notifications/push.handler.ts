import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { createSign } from 'crypto'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// Generate VAPID keys on module load if not configured
// Real VAPID uses P-256 elliptic curve keys
function getVapidPublicKey(): string {
  const key = process.env['VAPID_PUBLIC_KEY']
  if (key) return key
  logger.warn(
    'VAPID_PUBLIC_KEY not set — push notifications will not work. Run: node -e "const {generateKeyPairSync} = require(\'crypto\'); const {privateKey, publicKey} = generateKeyPairSync(\'ec\', {namedCurve: \'prime256v1\'}); console.log(publicKey.export({type:\'spki\',format:\'der\'}).toString(\'base64url\'))"',
  )
  return 'VAPID_NOT_CONFIGURED'
}

export function pushRouter(db: Pool): Router {
  const router = Router()

  // GET /push/vapid-key — return public VAPID key for client-side subscription
  router.get(
    '/vapid-key',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: { publicKey: getVapidPublicKey() } })
    }),
  )

  // POST /push/subscribe — save push subscription
  router.post(
    '/subscribe',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).auth!.userId
      const { endpoint, keys } = req.body as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_INPUT,
          'endpoint and keys.p256dh and keys.auth are required',
        )
      }

      const userAgent = req.headers['user-agent'] ?? null

      // Upsert — if endpoint exists for different user, update; if same user, ignore
      await db.query(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id = $2, p256dh = $4, auth = $5, user_agent = $6`,
        [randomUUID(), userId, endpoint, keys.p256dh, keys.auth, userAgent],
      )

      res.status(201).json({ data: { subscribed: true } })
    }),
  )

  // DELETE /push/subscribe — remove subscription
  router.delete(
    '/subscribe',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).auth!.userId
      const { endpoint } = req.body as { endpoint?: string }

      if (endpoint) {
        await db.query(
          'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
          [userId, endpoint],
        )
      } else {
        // Remove all subscriptions for user
        await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId])
      }

      res.status(204).send()
    }),
  )

  // GET /push/subscriptions — list user's subscriptions
  router.get(
    '/subscriptions',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).auth!.userId
      const { rows } = await db.query(
        'SELECT id, endpoint, user_agent, created_at FROM push_subscriptions WHERE user_id = $1',
        [userId],
      )
      res.json({ data: rows })
    }),
  )

  return router
}

// ============================================================
// Push sending utility (exported for use by notification service)
// Implements a simplified Web Push call. For full RFC 8291
// content encryption, integrate the web-push npm package.
// This version sends push notifications via direct HTTP to
// the push endpoint with a minimal VAPID JWT header.
// ============================================================

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const vapidPublicKey = process.env['VAPID_PUBLIC_KEY']
  const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY']

  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn('VAPID keys not configured — skipping push notification')
    return
  }

  try {
    // Build a minimal VAPID JWT
    const audience = new URL(subscription.endpoint).origin
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url')
    const body = Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: now + 3600,
        sub: process.env['VAPID_SUBJECT'] ?? 'mailto:admin@clickup.local',
      }),
    ).toString('base64url')

    // Sign with ES256 (P-256 ECDSA)
    // Note: For production, use the web-push npm package which handles
    // RFC 8291 content encryption correctly. This is a structural stub.
    const sign = createSign('SHA256')
    sign.update(`${header}.${body}`)
    const signature = sign
      .sign({
        key: vapidPrivateKey,
        dsaEncoding: 'ieee-p1363',
      } as any)
      .toString('base64url')

    const jwt = `${header}.${body}.${signature}`
    const jsonPayload = JSON.stringify(payload)

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        TTL: '86400',
        Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
      },
      body: jsonPayload,
    })

    if (!response.ok && response.status !== 201) {
      logger.error(
        { status: response.status, endpoint: subscription.endpoint },
        'Push notification failed',
      )
      if (response.status === 410) {
        // Subscription has expired — caller should clean it up
        throw new Error('SUBSCRIPTION_EXPIRED:' + subscription.endpoint)
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send push notification')
    throw err
  }
}
