"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectGatewayAuth = injectGatewayAuth;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const contracts_1 = require("@clickup/contracts");
const AppError_js_1 = require("../errors/AppError.js");
// ============================================================
// JWT verification middleware
// Mount on any route that requires authentication
// ============================================================
function injectGatewayAuth(req, _res, next) {
    const userId = req.headers['x-user-id'];
    if (userId) {
        req.auth = {
            userId,
            workspaceId: req.headers['x-workspace-id'] ?? '',
            role: req.headers['x-user-role'] ?? 'member',
            sessionId: req.headers['x-session-id'] ?? '',
        };
    }
    next();
}
function requireAuth(req, _res, next) {
    // If auth was already set by gateway X-User header middleware, skip JWT verification
    if (req.auth && req.auth.userId) {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
        console.error('[requireAuth] REJECTING - authHeader type:', typeof authHeader, 'isArray:', Array.isArray(authHeader), 'value:', JSON.stringify(authHeader));
        throw new AppError_js_1.AppError(contracts_1.ErrorCode.AUTH_MISSING_TOKEN);
    }
    const token = authHeader.slice(7);
    const secret = process.env['JWT_SECRET'];
    if (secret === undefined) {
        throw new AppError_js_1.AppError(contracts_1.ErrorCode.SYSTEM_INTERNAL_ERROR, 'JWT_SECRET not configured');
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (typeof payload.userId !== 'string' ||
            typeof payload.workspaceId !== 'string' ||
            typeof payload.role !== 'string' ||
            typeof payload.sessionId !== 'string') {
            throw new AppError_js_1.AppError(contracts_1.ErrorCode.AUTH_INVALID_TOKEN);
        }
        req.auth = {
            userId: payload.userId,
            workspaceId: payload.workspaceId,
            role: payload.role,
            sessionId: payload.sessionId,
        };
        next();
    }
    catch (err) {
        if (err instanceof AppError_js_1.AppError) {
            next(err);
            return;
        }
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new AppError_js_1.AppError(contracts_1.ErrorCode.AUTH_EXPIRED_TOKEN));
            return;
        }
        next(new AppError_js_1.AppError(contracts_1.ErrorCode.AUTH_INVALID_TOKEN));
    }
}
// ============================================================
// Role check middleware — use after requireAuth
// Usage: router.delete('/x', requireAuth, requireRole('admin'), handler)
// ============================================================
function requireRole(...allowedRoles) {
    return (req, _res, next) => {
        if (!allowedRoles.includes(req.auth.role)) {
            throw new AppError_js_1.AppError(contracts_1.ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        }
        next();
    };
}
// ============================================================
// JWT token factory — used only by identity-service
// ============================================================
function signToken(payload, expiresIn = '7d') {
    const secret = process.env['JWT_SECRET'];
    if (secret === undefined) {
        throw new AppError_js_1.AppError(contracts_1.ErrorCode.SYSTEM_INTERNAL_ERROR, 'JWT_SECRET not configured');
    }
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
}
//# sourceMappingURL=middleware.js.map