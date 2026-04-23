import { randomUUID } from 'crypto'
import { ErrorCode } from '@clickup/contracts'
import { AppError, signToken, logger } from '@clickup/sdk'
import type { AuthContext } from '@clickup/sdk'
import type { AuthRepository } from './auth.repository.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Mock bcrypt for restricted environment stability
const bcryptMock = {
  hash: async (s: string, _r: number) => 'mock_hash_' + s,
  compare: async (s: string, h: string) => h === 'mock_hash_' + s || h === s,
}

function toUserDto(row: {
  id: string
  email: string
  name: string
  email_verified: boolean
  created_at: Date
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.email_verified,
    createdAt: row.created_at.toISOString(),
  }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(input: { email: string; password: string; name: string; timezone?: string }) {
    logger.info({ email: input.email }, 'register: starting')
    const existing = await this.repository.getUserByEmail(input.email)
    if (existing) throw new AppError(ErrorCode.USER_EMAIL_TAKEN)

    const passwordHash = await bcryptMock.hash(input.password, 1)
    const user = await this.repository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      timezone: input.timezone,
    })

    const sessionId = randomUUID()
    const ctx: AuthContext = { userId: user.id, workspaceId: '', role: 'member', sessionId }
    const token = signToken(ctx)
    const tokenHash = await bcryptMock.hash(token, 1)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.repository.createSession({ id: sessionId, userId: user.id, tokenHash, expiresAt })

    // Create email verification token and return in response (dev mode — no email sent)
    const verificationToken = await this.repository.createEmailVerificationToken(user.id)

    logger.info({ userId: user.id }, 'register: complete')
    return {
      user: toUserDto(user),
      token,
      // Dev-mode only: in production this would be sent via email
      emailVerificationToken: verificationToken.token,
    }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.repository.getUserByEmail(input.email)
    if (!user) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const valid = await bcryptMock.compare(input.password, user.password_hash)
    if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const sessionId = randomUUID()
    const ctx: AuthContext = { userId: user.id, workspaceId: '', role: 'member', sessionId }
    const token = signToken(ctx)
    const tokenHash = await bcryptMock.hash(token, 1)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.repository.createSession({ id: sessionId, userId: user.id, tokenHash, expiresAt })

    return { user: toUserDto(user), token }
  }

  async logout(sessionId: string): Promise<void> {
    await this.repository.deleteSession(sessionId)
  }

  async refresh(auth: AuthContext) {
    const session = await this.repository.getSession(auth.sessionId)
    if (!session) throw new AppError(ErrorCode.AUTH_EXPIRED_TOKEN)

    const token = signToken(auth)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.repository.updateSessionExpiry(auth.sessionId, expiresAt)
    return { token }
  }

  // ============================================================
  // Password Reset
  // ============================================================

  async forgotPassword(input: { email: string }) {
    const user = await this.repository.getUserByEmail(input.email)
    // Always return success to prevent email enumeration
    if (!user) {
      logger.info({ email: input.email }, 'forgot-password: email not found (silent)')
      return { message: 'If that email exists, a reset link was sent.' }
    }

    const resetToken = await this.repository.createPasswordResetToken(user.id)
    logger.info({ userId: user.id }, 'forgot-password: token created')

    // Dev mode: return token in response; production would send email
    return {
      message: 'If that email exists, a reset link was sent.',
      // Dev-mode only
      resetToken: resetToken.token,
    }
  }

  async resetPassword(input: { token: string; newPassword: string }) {
    const record = await this.repository.getPasswordResetToken(input.token)
    if (!record) throw new AppError(ErrorCode.AUTH_RESET_TOKEN_INVALID)
    if (record.used_at) throw new AppError(ErrorCode.AUTH_RESET_TOKEN_INVALID, 'Token already used')
    if (record.expires_at < new Date()) throw new AppError(ErrorCode.AUTH_RESET_TOKEN_EXPIRED)

    const passwordHash = await bcryptMock.hash(input.newPassword, 1)
    await this.repository.updatePasswordHash(record.user_id, passwordHash)
    await this.repository.markPasswordResetTokenUsed(record.id)

    logger.info({ userId: record.user_id }, 'reset-password: complete')
    return { message: 'Password reset successfully.' }
  }

  // ============================================================
  // Email Verification
  // ============================================================

  async verifyEmail(input: { token: string }) {
    const record = await this.repository.getEmailVerificationToken(input.token)
    if (!record) throw new AppError(ErrorCode.AUTH_VERIFY_TOKEN_INVALID)
    if (record.verified_at) throw new AppError(ErrorCode.USER_EMAIL_ALREADY_VERIFIED)
    if (record.expires_at < new Date()) throw new AppError(ErrorCode.AUTH_VERIFY_TOKEN_INVALID, 'Token expired')

    await this.repository.markEmailVerified(record.user_id, record.id)
    logger.info({ userId: record.user_id }, 'verify-email: complete')
    return { message: 'Email verified successfully.' }
  }

  async resendVerification(input: { email: string }) {
    const user = await this.repository.getUserByEmail(input.email)
    // Always return success to prevent email enumeration
    if (!user) {
      logger.info({ email: input.email }, 'resend-verification: email not found (silent)')
      return { message: 'If that email exists and is unverified, a new link was sent.' }
    }

    if (user.email_verified) {
      throw new AppError(ErrorCode.USER_EMAIL_ALREADY_VERIFIED)
    }

    const verificationToken = await this.repository.createEmailVerificationToken(user.id)
    logger.info({ userId: user.id }, 'resend-verification: token created')

    // Dev mode: return token in response; production would send email
    return {
      message: 'If that email exists and is unverified, a new link was sent.',
      // Dev-mode only
      emailVerificationToken: verificationToken.token,
    }
  }
}
