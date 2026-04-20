"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceClient = createServiceClient;
const axios_1 = __importDefault(require("axios"));
const contracts_1 = require("@clickup/contracts");
const AppError_js_1 = require("../errors/AppError.js");
const logger_js_1 = require("../logging/logger.js");
// ============================================================
// Internal HTTP client for service-to-service calls
// Includes: retry, timeout, correlation ID forwarding, error normalization
// ============================================================
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];
function createServiceClient(baseURL, options = {}) {
    const client = axios_1.default.create({
        baseURL,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/json',
            ...(options.traceId !== undefined && { 'x-trace-id': options.traceId }),
            'x-internal': 'true',
        },
    });
    // Retry interceptor
    client.interceptors.response.use((response) => response, async (error) => {
        if (!axios_1.default.isAxiosError(error))
            throw error;
        const config = error.config;
        const status = error.response?.status ?? 0;
        config._retryCount = config._retryCount ?? 0;
        if (config._retryCount < MAX_RETRIES &&
            RETRYABLE_STATUS_CODES.includes(status)) {
            config._retryCount++;
            const delay = Math.min(config._retryCount * 500, 2000);
            await sleep(delay);
            logger_js_1.logger.warn({ status, attempt: config._retryCount, baseURL }, 'Retrying request');
            return client.request(config);
        }
        // Normalize to AppError
        const errorData = error.response?.data;
        const code = errorData?.error?.code ?? contracts_1.ErrorCode.SYSTEM_SERVICE_UNAVAILABLE;
        const message = errorData?.error?.message ?? 'Service call failed';
        throw new AppError_js_1.AppError(code, message);
    });
    return client;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=client.js.map