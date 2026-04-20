"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.isAppError = isAppError;
const contracts_1 = require("@clickup/contracts");
// ============================================================
// AppError — the ONLY error class agents throw
// Never throw raw Error objects in service code.
// Usage: throw new AppError(ErrorCode.TASK_NOT_FOUND)
// ============================================================
class AppError extends Error {
    code;
    status;
    details;
    constructor(code, message, details) {
        super(message ?? code);
        this.name = 'AppError';
        this.code = code;
        this.status = contracts_1.ERROR_STATUS_MAP[code];
        if (details) {
            this.details = details;
        }
        Error.captureStackTrace(this, this.constructor);
    }
    toResponse(traceId) {
        return {
            error: {
                code: this.code,
                message: this.message,
                status: this.status,
                traceId,
                ...(this.details !== undefined && { details: this.details }),
            },
        };
    }
}
exports.AppError = AppError;
function isAppError(err) {
    return err instanceof AppError;
}
//# sourceMappingURL=AppError.js.map