import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { ErrorCode } from '@clickup/contracts'
import { AppError, signToken } from '@clickup/sdk'
import type { AuthContext } from '@clickup/sdk'
import type { AuthRepository } from './auth.repository.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function toUserDto(row: { id: string; email: string; name: string; created_at: Date }) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(input: { email: string; password: string; name: string; timezone?: string }) {
    const existing = await this.repository.getUserByEmail(input.email)
    if (existing) throw new AppError(ErrorCode.USER_EMAIL_TAKEN)

    const passwordHash = await bcrypt.hash(input.password, 12)
    const user = await this.repository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      timezone: input.timezone,
    })

    const sessionId = randomUUID()
    const ctx: AuthContext = { userId: user.id, workspaceId: '', role: 'member', sessionId }
    const token = signToken(ctx)
    const tokenHash = await bcrypt.hash(token, 8)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.repository.createSession({ id: sessionId, userId: user.id, tokenHash, expiresAt })

    return { user: toUserDto(user), token }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.repository.getUserByEmail(input.email)
    // Same error for wrong email OR wrong password — no user enumeration
    if (!user) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const valid = await bcrypt.compare(input.password, user.password_hash)
    if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const sessionId = randomUUID()
    const ctx: AuthContext = { userId: user.id, workspaceId: '', role: 'member', sessionId }
    const token = signToken(ctx)
    const tokenHash = await bcrypt.hash(token, 8)
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
}
