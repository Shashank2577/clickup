"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTestToken = makeTestToken;
exports.authHeader = authHeader;
exports.testAuth = testAuth;
const sdk_1 = require("@clickup/sdk");
function makeTestToken(ctx) {
    return (0, sdk_1.signToken)({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        role: ctx.role ?? 'member',
        sessionId: ctx.sessionId ?? 'test-session',
    });
}
function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
}
function testAuth(ctx) {
    const token = makeTestToken(ctx);
    return { token, headers: authHeader(token) };
}
//# sourceMappingURL=auth.js.map