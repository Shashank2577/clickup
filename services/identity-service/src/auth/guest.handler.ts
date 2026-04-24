import { Router } from 'express'
import type { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { asyncHandler, AppError, logger, signToken } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// Guest link handler
// guest_links: id, workspace_id, token, role, max_uses, use_count,
//              expires_at, created_by, created_at
// Mounted at /auth — routes become /auth/guest/...
// ============================================================

interface GuestLinkRow {
  id: string
  workspace_id: string
  token: string
  role: string
  max_uses: number | null
  use_count: number
  expires_at: Date | null
  created_by: string
  created_at: Date
}

export function guestRouter(db: Pool): Router {
  const router = Router()

  // GET /auth/guest/validate?token= — check if a guest link is valid
  router.get(
    '/guest/validate',
    asyncHandler(async (req, res) => {
      const { token } = req.query as { token?: string }
      if (!token || typeof token !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'token query parameter is required')
      }

      const linkR = await db.query<GuestLinkRow>(
        `SELECT id, workspace_id, token, role, max_uses, use_count, expires_at, created_by, created_at
         FROM guest_links
         WHERE token = $1`,
        [token],
      )
      const link = linkR.rows[0]

      if (!link) {
        res.json({ data: { valid: false, reason: 'not_found' } })
        return
      }

      if (link.expires_at !== null && new Date() > link.expires_at) {
        res.json({ data: { valid: false, reason: 'expired' } })
        return
      }

      if (link.max_uses !== null && link.use_count >= link.max_uses) {
        res.json({ data: { valid: false, reason: 'max_uses_reached' } })
        return
      }

      // Fetch workspace name for display
      const workspaceR = await db.query<{ name: string }>(
        `SELECT name FROM workspaces WHERE id = $1`,
        [link.workspace_id],
      )
      const workspaceName = workspaceR.rows[0]?.name ?? null

      res.json({ data: { valid: true, workspaceName, role: link.role } })
    }),
  )

  // POST /auth/guest/redeem — register with guest link token
  router.post(
    '/guest/redeem',
    asyncHandler(async (req, res) => {
      const { token, email, password, name } = req.body as {
        token?: string
        email?: string
        password?: string
        name?: string
      }

      if (!token || !email || !password || !name) {
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_INPUT,
          'token, email, password, and name are required',
        )
      }

      // Validate and lock the guest link row
      const linkR = await db.query<GuestLinkRow>(
        `SELECT id, workspace_id, token, role, max_uses, use_count, expires_at, created_by, created_at
         FROM guest_links
         WHERE token = $1`,
        [token],
      )
      const link = linkR.rows[0]

      if (!link) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid guest link token')
      }
      if (link.expires_at !== null && new Date() > link.expires_at) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Guest link has expired')
      }
      if (link.max_uses !== null && link.use_count >= link.max_uses) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Guest link has reached its maximum uses')
      }

      // Check email not already taken
      const existingUser = await db.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      )
      if (existingUser.rows[0]) {
        throw new AppError(ErrorCode.USER_EMAIL_TAKEN)
      }

      const client = await db.connect()
      try {
        await client.query('BEGIN')

        // Create user (password stored as placeholder; real bcrypt omitted per project mock pattern)
        const newUserR = await client.query<{ id: string; email: string; name: string; role: string }>(
          `INSERT INTO users (email, name, password_hash, role)
           VALUES ($1, $2, $3, 'member')
           RETURNING id, email, name, role`,
          [email, name, 'guest_password_placeholder:' + randomUUID()],
        )
        const user = newUserR.rows[0]!

        // Add to workspace as guest role from the link
        await client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (workspace_id, user_id) DO NOTHING`,
          [link.workspace_id, user.id, link.role],
        )

        // Increment use_count
        await client.query(
          `UPDATE guest_links SET use_count = use_count + 1 WHERE id = $1`,
          [link.id],
        )

        await client.query('COMMIT')

        const token = signToken({
          userId: user.id,
          workspaceId: link.workspace_id,
          role: link.role,
          sessionId: randomUUID(),
        })

        logger.info({ userId: user.id, workspaceId: link.workspace_id, role: link.role }, 'guest: link redeemed')
        res.status(201).json({
          data: {
            token,
            user: { id: user.id, email: user.email, name: user.name, role: link.role },
            workspaceId: link.workspace_id,
          },
        })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }),
  )

  return router
}
