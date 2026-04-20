declare const MAX_TOKENS_PER_MIN: number;
declare const MAX_REQUESTS_PER_MIN: number;
/**
 * Checks if the workspace is within rate limits BEFORE calling Claude.
 * Throws AI_RATE_LIMITED if over limit.
 */
export declare function checkAiRateLimit(workspaceId: string): Promise<void>;
/**
 * Records token usage AFTER a successful Claude call.
 * For observability — token limit enforcement is a Wave 3 feature.
 */
export declare function recordTokenUsage(workspaceId: string, inputTokens: number, outputTokens: number): Promise<void>;
/**
 * Returns current usage stats for a workspace (for /health or admin endpoints).
 */
export declare function getAiUsageStats(workspaceId: string): Promise<{
    requestsThisMinute: number;
    tokensThisMinute: number;
}>;
export { MAX_TOKENS_PER_MIN, MAX_REQUESTS_PER_MIN };
//# sourceMappingURL=rate-limiter.d.ts.map