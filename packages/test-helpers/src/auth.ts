import { signToken } from '@clickup/sdk'

export interface TestAuthContext {
  userId: string
  workspaceId: string
  role?: string
  sessionId?: string
}

export function makeTestToken(ctx: TestAuthContext): string {
  return signToken({
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    role: ctx.role ?? 'member',
    sessionId: ctx.sessionId ?? 'test-session',
  })
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

export function testAuth(ctx: TestAuthContext): {
  token: string
  headers: { Authorization: string }
} {
  const token = makeTestToken(ctx)
  return { token, headers: authHeader(token) }
}
