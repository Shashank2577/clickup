export interface LlmCallOptions {
    workspaceId: string;
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    timeoutMs?: number;
}
export interface LlmMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface LlmResponse {
    content: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
}
/**
 * Calls Claude with retry logic and error normalization.
 * This is the ONLY function in the codebase that calls the Anthropic API.
 * All AI capabilities (breakdown, summarize, etc.) call this.
 */
export declare function callClaude(messages: LlmMessage[], options: LlmCallOptions): Promise<LlmResponse>;
//# sourceMappingURL=client.d.ts.map