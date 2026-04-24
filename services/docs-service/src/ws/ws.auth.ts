import jwt from 'jsonwebtoken'

interface JwtPayload { userId: string; workspaceId: string; role: string; sessionId: string }

export function verifyWsJwt(token: string): JwtPayload {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.verify(token, secret) as JwtPayload
}
