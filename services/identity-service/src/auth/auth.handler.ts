import { Router } from 'express'
import type { Pool } from 'pg'
import { asyncHandler, validate, requireAuth } from '@clickup/sdk'
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
} from '@clickup/contracts'
import { AuthRepository } from './auth.repository.js'
import { AuthService } from './auth.service.js'

export function authRoutes(db: Pool): Router {
  const router = Router()
  const repository = new AuthRepository(db)
  const service = new AuthService(repository)

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const body = validate(RegisterSchema, req.body)
      const result = await service.register(body)
      res.status(201).json({ data: result })
    }),
  )

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = validate(LoginSchema, req.body)
      const result = await service.login(body)
      res.json({ data: result })
    }),
  )

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await service.logout(req.auth.sessionId)
      res.status(204).end()
    }),
  )

  router.get(
    '/verify',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ data: req.auth })
    }),
  )

  router.post(
    '/refresh',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await service.refresh(req.auth)
      res.json({ data: result })
    }),
  )

  // ============================================================
  // Password Reset
  // ============================================================

  router.post(
    '/forgot-password',
    asyncHandler(async (req, res) => {
      const body = validate(ForgotPasswordSchema, req.body)
      const result = await service.forgotPassword(body)
      res.json({ data: result })
    }),
  )

  router.post(
    '/reset-password',
    asyncHandler(async (req, res) => {
      const body = validate(ResetPasswordSchema, req.body)
      const result = await service.resetPassword(body)
      res.json({ data: result })
    }),
  )

  // ============================================================
  // Email Verification
  // ============================================================

  router.post(
    '/verify-email',
    asyncHandler(async (req, res) => {
      const body = validate(VerifyEmailSchema, req.body)
      const result = await service.verifyEmail(body)
      res.json({ data: result })
    }),
  )

  router.post(
    '/resend-verification',
    asyncHandler(async (req, res) => {
      const body = validate(ResendVerificationSchema, req.body)
      const result = await service.resendVerification(body)
      res.json({ data: result })
    }),
  )

  // ============================================================
  // Clerk Sign-In Sync — upserts user + personal workspace on first login.
  // The API gateway validates the Clerk JWT and sets x-user-id.
  // A personal workspace keyed to userId is created if missing.
  // ============================================================

  router.post(
    '/sync',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.auth.userId

      const { email, name } = req.body as { email: string; name: string }

      // Upsert user
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, timezone)
         VALUES ($1, $2, $3, '', 'UTC')
         ON CONFLICT (id) DO UPDATE SET email = $2, name = $3`,
        [userId, email, name],
      )

      // Ensure a personal workspace exists (id = userId prefix + -ws)
      const wsId   = userId + '-ws'
      const wsName = (name || email).split('@')[0] + "'s Workspace"
      const wsSlug = wsId
      await db.query(
        `INSERT INTO workspaces (id, name, slug, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [wsId, wsName, wsSlug, userId],
      )
      await db.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [wsId, userId],
      )

      res.json({ data: { synced: true, workspaceId: wsId } })
    }),
  )

  return router
}
