import { Router } from 'express'
import type { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { asyncHandler, AppError, logger, signToken } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// Google OAuth helpers
// ============================================================

function buildGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env['GOOGLE_CLIENT_ID'] ?? '',
    redirect_uri:
      process.env['GOOGLE_REDIRECT_URI'] ??
      'http://localhost:3001/api/v1/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    state: randomUUID(),
  })
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString()
}

async function exchangeGoogleCode(code: string): Promise<{
  email: string
  name: string
  id: string
  picture?: string
}> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env['GOOGLE_CLIENT_ID'] ?? '',
      client_secret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
      redirect_uri:
        process.env['GOOGLE_REDIRECT_URI'] ??
        'http://localhost:3001/api/v1/auth/google/callback',
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!tokenRes.ok) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Google token exchange failed')
  }
  const tokens = (await tokenRes.json()) as { access_token: string }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  })
  if (!userRes.ok) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Google user info failed')
  }
  return userRes.json() as Promise<{ email: string; name: string; id: string; picture?: string }>
}

// ============================================================
// GitHub OAuth helpers
// ============================================================

function buildGithubAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env['GITHUB_CLIENT_ID'] ?? '',
    redirect_uri:
      process.env['GITHUB_REDIRECT_URI'] ??
      'http://localhost:3001/api/v1/auth/github/callback',
    scope: 'read:user user:email',
    state: randomUUID(),
  })
  return 'https://github.com/login/oauth/authorize?' + params.toString()
}

async function exchangeGithubCode(code: string): Promise<{
  email: string
  name: string
  id: string
  avatar_url?: string
}> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env['GITHUB_CLIENT_ID'] ?? '',
      client_secret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
      redirect_uri:
        process.env['GITHUB_REDIRECT_URI'] ??
        'http://localhost:3001/api/v1/auth/github/callback',
    }).toString(),
  })
  if (!tokenRes.ok) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'GitHub token exchange failed')
  }
  const tokens = (await tokenRes.json()) as { access_token: string; error?: string }
  if (tokens.error) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'GitHub token exchange error: ' + tokens.error)
  }

  // Fetch user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: 'Bearer ' + tokens.access_token,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!userRes.ok) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'GitHub user info failed')
  }
  const user = (await userRes.json()) as {
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url?: string
  }

  // If email is private, fetch from emails endpoint
  let email = user.email
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: 'Bearer ' + tokens.access_token,
        Accept: 'application/vnd.github+json',
      },
    })
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string
        primary: boolean
        verified: boolean
      }>
      const primary = emails.find((e) => e.primary && e.verified)
      email = primary ? primary.email : (emails[0]?.email ?? null)
    }
  }

  if (!email) {
    throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Could not retrieve GitHub email')
  }

  return {
    id: String(user.id),
    email,
    name: user.name ?? user.login,
    avatar_url: user.avatar_url,
  }
}

// ============================================================
// DB upsert — finds or creates user + oauth_accounts row
// ============================================================

interface OAuthProfile {
  provider: 'google' | 'github'
  providerUserId: string
  email: string
  name: string
  avatarUrl?: string
  accessToken?: string
}

async function upsertOAuthUser(
  db: Pool,
  profile: OAuthProfile,
): Promise<{ id: string; email: string; name: string; role: string }> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Check for existing oauth_accounts row
    const oauthR = await client.query<{ user_id: string }>(
      `SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2`,
      [profile.provider, profile.providerUserId],
    )

    let userId: string

    if (oauthR.rows[0]) {
      // Existing OAuth account — update tokens
      userId = oauthR.rows[0].user_id
      await client.query(
        `UPDATE oauth_accounts
         SET access_token = $1, provider_email = $2, provider_name = $3, avatar_url = $4, updated_at = NOW()
         WHERE provider = $5 AND provider_user_id = $6`,
        [
          profile.accessToken ?? null,
          profile.email,
          profile.name,
          profile.avatarUrl ?? null,
          profile.provider,
          profile.providerUserId,
        ],
      )
    } else {
      // Try to find user by email
      const userByEmail = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1`,
        [profile.email],
      )

      if (userByEmail.rows[0]) {
        userId = userByEmail.rows[0].id
      } else {
        // Create new user
        const newUser = await client.query<{ id: string }>(
          `INSERT INTO users (email, name, password_hash, role)
           VALUES ($1, $2, $3, 'member')
           RETURNING id`,
          [profile.email, profile.name, 'oauth:' + profile.provider],
        )
        userId = newUser.rows[0]!.id
      }

      // Create oauth_accounts row
      await client.query(
        `INSERT INTO oauth_accounts
           (user_id, provider, provider_user_id, access_token, provider_email, provider_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (provider, provider_user_id) DO UPDATE
           SET access_token = EXCLUDED.access_token,
               provider_email = EXCLUDED.provider_email,
               provider_name = EXCLUDED.provider_name,
               avatar_url = EXCLUDED.avatar_url,
               updated_at = NOW()`,
        [
          userId,
          profile.provider,
          profile.providerUserId,
          profile.accessToken ?? null,
          profile.email,
          profile.name,
          profile.avatarUrl ?? null,
        ],
      )
    }

    await client.query('COMMIT')

    const userR = await db.query<{ id: string; email: string; name: string; role: string }>(
      `SELECT id, email, name, role FROM users WHERE id = $1`,
      [userId],
    )
    const user = userR.rows[0]
    if (!user) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'User not found after upsert')
    return user
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ============================================================
// Router
// ============================================================

export function oauthRouter(db: Pool): Router {
  const router = Router()

  // GET /auth/google — redirect to Google consent screen
  router.get(
    '/google',
    asyncHandler(async (_req, res) => {
      const url = buildGoogleAuthUrl()
      res.redirect(url)
    }),
  )

  // GET /auth/google/callback — exchange code, upsert user, return JWT
  router.get(
    '/google/callback',
    asyncHandler(async (req, res) => {
      const { code } = req.query as { code?: string }
      if (!code) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Missing OAuth code')
      }

      const profile = await exchangeGoogleCode(code)
      logger.info({ provider: 'google', providerUserId: profile.id }, 'oauth: callback received')

      const user = await upsertOAuthUser(db, {
        provider: 'google',
        providerUserId: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
      })

      const token = signToken({
        userId: user.id,
        workspaceId: '',
        role: user.role,
        sessionId: randomUUID(),
      })

      logger.info({ userId: user.id, provider: 'google' }, 'oauth: login complete')
      res.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } } })
    }),
  )

  // GET /auth/github — redirect to GitHub consent screen
  router.get(
    '/github',
    asyncHandler(async (_req, res) => {
      const url = buildGithubAuthUrl()
      res.redirect(url)
    }),
  )

  // GET /auth/github/callback — exchange code, upsert user, return JWT
  router.get(
    '/github/callback',
    asyncHandler(async (req, res) => {
      const { code } = req.query as { code?: string }
      if (!code) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Missing OAuth code')
      }

      const profile = await exchangeGithubCode(code)
      logger.info({ provider: 'github', providerUserId: profile.id }, 'oauth: callback received')

      const user = await upsertOAuthUser(db, {
        provider: 'github',
        providerUserId: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatar_url,
      })

      const token = signToken({
        userId: user.id,
        workspaceId: '',
        role: user.role,
        sessionId: randomUUID(),
      })

      logger.info({ userId: user.id, provider: 'github' }, 'oauth: login complete')
      res.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } } })
    }),
  )

  return router
}
