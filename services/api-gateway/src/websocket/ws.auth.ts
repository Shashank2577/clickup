import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'

export interface WsAuthContext {
  userId: string
  workspaceId: string
  sessionId: string
  role: string
}

export function verifyWsAuth(req: IncomingMessage): WsAuthContext | null {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const token =
    url.searchParams.get('token') ??
    req.headers['authorization']?.slice(7)

  if (!token) return null

  const secret = process.env['JWT_SECRET']
  if (!secret) return null

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & WsAuthContext
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.workspaceId !== 'string'
    ) {
      return null
    }
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId ?? '',
      role: payload.role ?? 'member',
    }
  } catch {
    return null
  }
}
