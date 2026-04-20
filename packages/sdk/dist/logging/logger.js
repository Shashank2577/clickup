"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
// ============================================================
// Structured logger — all services use this, never console.log
// ============================================================
exports.logger = (0, pino_1.default)({
    level: process.env['LOG_LEVEL'] ?? 'info',
    base: {
        service: process.env['SERVICE_NAME'] ?? 'unknown',
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
    },
});
// ============================================================
// HTTP request logger middleware
// Mount before routes: app.use(httpLogger)
// ============================================================
exports.httpLogger = (0, pino_http_1.default)({
    logger: exports.logger,
    customLogLevel: (_req, res) => {
        if (res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} → ${res.statusCode}: ${err.message}`,
    redact: {
        paths: ['req.headers.authorization', 'req.body.password'],
        censor: '[REDACTED]',
    },
});
//# sourceMappingURL=logger.js.map