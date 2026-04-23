import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk'
import { ErrorCode, CreateInviteSchema, AcceptInviteSchema } from '@clickup/contracts'

interface InviteRow {
  id: string
  workspace_id: string
  email: string
  role: string
  token: string
  invited_by: string
  accepted_at: Date | null
  expires_at: Date
  created_at: Date
}

function toInviteDto(row: InviteRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invited_by,
    acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  }
}

// Mounted at: /workspaces/:workspaceId/invites
export function workspaceInvitesRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  // GET /workspaces/:workspaceId/invites — list pending invites (admin/owner only)
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const memberR = await db.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      const member = memberR.rows[0]
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const r = await db.query<InviteRow>(
        `SELECT id, workspace_id, email, role, token, invited_by, accepted_at, expires_at, created_at
         FROM workspace_invites
         WHERE workspace_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [workspaceId],
      )
      res.json({ data: r.rows.map(toInviteDto) })
    }),
  )

  // POST /workspaces/:workspaceId/invites — send invite
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required')

      const callerR = await db.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      const caller = callerR.rows[0]
      if (!caller) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(caller.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const input = validate(CreateInviteSchema, req.body)

      // Check email not already a workspace member
      const existingUser = await db.query(
        `SELECT id FROM users WHERE email = $1`,
        [input.email],
      )
      if (existingUser.rows[0]) {
        const existingMember = await db.query(
          `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
          [workspaceId, existingUser.rows[0].id],
        )
        if (existingMember.rows[0]) throw new AppError(ErrorCode.WORKSPACE_MEMBER_ALREADY_EXISTS)
      }

      // Upsert invite (workspace+email unique constraint)
      const r = await db.query<InviteRow>(
        `INSERT INTO workspace_invites (workspace_id, email, role, invited_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, email) DO UPDATE
           SET role = EXCLUDED.role,
               invited_by = EXCLUDED.invited_by,
               accepted_at = NULL,
               expires_at = NOW() + INTERVAL '7 days',
               token = encode(gen_random_bytes(24), 'base64url')
         RETURNING id, workspace_id, email, role, token, invited_by, accepted_at, expires_at, created_at`,
        [workspaceId, input.email, input.role, req.auth.userId],
      )
      const invite = r.rows[0]!

      // Log invite (no email service yet)
      console.log('Invite sent to', input.email, 'for workspace', workspaceId, 'token:', invite.token)

      res.status(201).json({ data: toInviteDto(invite) })
    }),
  )

  // DELETE /workspaces/:workspaceId/invites/:id — cancel invite
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId, id } = req.params
      if (!workspaceId || !id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required')

      const memberR = await db.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, req.auth.userId],
      )
      const member = memberR.rows[0]
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const r = await db.query(
        `DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2`,
        [id, workspaceId],
      )
      if (r.rowCount === 0) throw new AppError(ErrorCode.WORKSPACE_INVITE_NOT_FOUND)
      res.status(204).end()
    }),
  )

  return router
}

// Mounted at: /invites
export function inviteAcceptRouter(db: Pool): Router {
  const router = Router()

  // POST /invites/accept — accept invite by token (requires auth)
  router.post(
    '/accept',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(AcceptInviteSchema, req.body)

      // Find the invite by token
      const inviteR = await db.query<InviteRow>(
        `SELECT id, workspace_id, email, role, token, invited_by, accepted_at, expires_at, created_at
         FROM workspace_invites
         WHERE token = $1`,
        [input.token],
      )
      const invite = inviteR.rows[0]
      if (!invite) throw new AppError(ErrorCode.WORKSPACE_INVITE_NOT_FOUND)
      if (invite.accepted_at !== null) throw new AppError(ErrorCode.WORKSPACE_INVITE_ALREADY_ACCEPTED)
      if (new Date() > invite.expires_at) throw new AppError(ErrorCode.WORKSPACE_INVITE_EXPIRED)

      const client = await db.connect()
      try {
        await client.query('BEGIN')

        // Add user to workspace_members (ignore if already exists)
        await client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (workspace_id, user_id) DO NOTHING`,
          [invite.workspace_id, req.auth.userId, invite.role],
        )

        // Mark invite as accepted
        await client.query(
          `UPDATE workspace_invites SET accepted_at = NOW() WHERE id = $1`,
          [invite.id],
        )

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      // Return workspace info
      const workspaceR = await db.query(
        `SELECT id, name, slug, owner_id, logo_url, created_at FROM workspaces WHERE id = $1`,
        [invite.workspace_id],
      )
      const workspace = workspaceR.rows[0]

      res.json({
        data: {
          workspace: workspace
            ? {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                ownerId: workspace.owner_id,
                logoUrl: workspace.logo_url,
                createdAt: workspace.created_at.toISOString(),
              }
            : null,
          role: invite.role,
        },
      })
    }),
  )

  return router
}
