import type { Request, Response, NextFunction } from 'express';
export interface AuthContext {
    userId: string;
    workspaceId: string;
    role: string;
    sessionId: string;
}
declare global {
    namespace Express {
        interface Request {
            auth: AuthContext;
        }
    }
}
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): void;
export declare function requireRole(...allowedRoles: string[]): (req: Request, _res: Response, next: NextFunction) => void;
export declare function signToken(payload: AuthContext, expiresIn?: string): string;
//# sourceMappingURL=middleware.d.ts.map