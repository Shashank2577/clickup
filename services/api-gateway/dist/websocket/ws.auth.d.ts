import { IncomingMessage } from 'http';
export interface WsAuthContext {
    userId: string;
    workspaceId: string;
    sessionId: string;
    role: string;
}
export declare function verifyWsAuth(req: IncomingMessage): WsAuthContext | null;
//# sourceMappingURL=ws.auth.d.ts.map