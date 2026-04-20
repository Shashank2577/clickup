import type { Express } from 'express';
import supertest from 'supertest';
import { type TestAuthContext } from './auth.js';
export declare function createTestRequest(app: Express): {
    get: (path: string) => AuthedRequest;
    post: (path: string) => AuthedRequest;
    patch: (path: string) => AuthedRequest;
    put: (path: string) => AuthedRequest;
    delete: (path: string) => AuthedRequest;
};
declare class AuthedRequest {
    private req;
    constructor(req: supertest.Test);
    asUser(ctx: TestAuthContext): supertest.Test;
    unauthenticated(): supertest.Test;
    raw(): supertest.Test;
}
export {};
//# sourceMappingURL=request.d.ts.map