"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
const contracts_1 = require("@clickup/contracts");
const AppError_js_1 = require("./AppError.js");
const logger_js_1 = require("../logging/logger.js");
// ============================================================
// Global Express error handler — mount as LAST middleware
// Ensures all errors return the standard AppErrorResponse shape
// ============================================================
function errorHandler(err, req, res, _next) {
    const traceId = req.headers['x-trace-id'] ?? 'unknown';
    if ((0, AppError_js_1.isAppError)(err)) {
        // Known application errors — log at warn level
        logger_js_1.logger.warn({ code: err.code, traceId, path: req.path }, err.message);
        res.status(err.status).json(err.toResponse(traceId));
        return;
    }
    // Unknown errors — log full stack, return generic 500
    logger_js_1.logger.error({ err, traceId, path: req.path }, 'Unhandled error');
    const systemError = new AppError_js_1.AppError(contracts_1.ErrorCode.SYSTEM_INTERNAL_ERROR, 'An unexpected error occurred');
    res.status(500).json(systemError.toResponse(traceId));
}
// ============================================================
// Async route handler wrapper — prevents unhandled promise rejections
// Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
// ============================================================
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
//# sourceMappingURL=handler.js.map