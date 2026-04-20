import jwt from 'jsonwebtoken';
export function verifyWsAuth(req) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const authHeader = req.headers['authorization'];
    const token = url.searchParams.get('token') ??
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    if (!token)
        return null;
    const secret = process.env['JWT_SECRET'];
    if (!secret)
        return null;
    try {
        const payload = jwt.verify(token, secret);
        if (typeof payload.userId !== 'string' ||
            typeof payload.workspaceId !== 'string') {
            return null;
        }
        return {
            userId: payload.userId,
            workspaceId: payload.workspaceId,
            sessionId: payload.sessionId ?? '',
            role: payload.role ?? 'member',
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=ws.auth.js.map