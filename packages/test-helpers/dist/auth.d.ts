export interface TestAuthContext {
    userId: string;
    workspaceId: string;
    role?: string;
    sessionId?: string;
}
export declare function makeTestToken(ctx: TestAuthContext): string;
export declare function authHeader(token: string): {
    Authorization: string;
};
export declare function testAuth(ctx: TestAuthContext): {
    token: string;
    headers: {
        Authorization: string;
    };
};
//# sourceMappingURL=auth.d.ts.map