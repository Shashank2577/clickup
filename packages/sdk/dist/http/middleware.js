"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationId = correlationId;
const crypto_1 = require("crypto");
// ============================================================
// Correlation ID middleware
// Ensures every request has a trace ID for log correlation.
// Mount before all routes and after httpLogger.
// ============================================================
function correlationId(req, res, next) {
    const traceId = req.headers['x-trace-id'] ?? (0, crypto_1.randomUUID)();
    req.headers['x-trace-id'] = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
}
//# sourceMappingURL=middleware.js.map