import { ErrorCode } from '@clickup/contracts';
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly status: number;
    readonly details?: Record<string, unknown>;
    constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>);
    toResponse(traceId: string): object;
}
export declare function isAppError(err: unknown): err is AppError;
//# sourceMappingURL=AppError.d.ts.map