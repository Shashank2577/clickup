# Work Order — AI Service: Infrastructure
**Wave:** 2
**Session ID:** WO-025
**Depends on:** WO-000 (foundation), WO-009 (test-helpers)
**Branch name:** `wave2/ai-infrastructure`
**Estimated time:** 2 hours

---

## 1. Mission

Build the AI service infrastructure layer: the Claude API client, retry logic,
rate limiting (per workspace), prompt builder, and all 6 failure mode handlers.
This WO does NOT implement any AI capabilities — it builds the foundation that
WO-026 (task breakdown), WO-027 (summarize/prioritize), and WO-028 (daily plan)
all depend on. AI is self-hosted: users bring their own Anthropic API key.

---

## 2. Context

```
task-service / comment-service / docs-service (HTTP clients)
  → POST /ai/task-breakdown          → ai-service (:3006)
  → POST /ai/summarize               → ai-service (:3006)
  → POST /ai/prioritize              → ai-service (:3006)
  → POST /ai/daily-plan              → ai-service (:3006)

ai-service (:3006)
  → Anthropic Claude API (external, user's own key)
  ← reads ANTHROPIC_API_KEY from per-workspace config
     (stored in workspaces.ai_config JSONB column, Wave 3)
     (for now: use ANTHROPIC_API_KEY env var as global fallback)

Failure modes this WO handles:
  1. API key not configured → AI_NOT_CONFIGURED (422)
  2. Claude API rate limit → AI_RATE_LIMITED (429, retry after N seconds)
  3. Claude API overloaded → AI_UNAVAILABLE (503, exponential backoff)
  4. Claude timeout (> 30s) → AI_TIMEOUT (504)
  5. Invalid/expired API key → AI_AUTH_FAILED (401)
  6. Model output unparseable → AI_INVALID_RESPONSE (500, log + return raw)
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/ai-service
cd services/ai-service
# package.json: "name": "@clickup/ai-service"
# .env: SERVICE_NAME=ai-service, PORT=3006
```

Additional dependencies:
```bash
pnpm add @anthropic-ai/sdk zod
```

---

## 4. Files to Create

```
services/ai-service/
├── src/
│   ├── index.ts                    [copy from _template, PORT=3006]
│   ├── routes.ts                   [register AI capability routes]
│   └── llm/
│       ├── client.ts               [Anthropic SDK wrapper with retry]
│       ├── rate-limiter.ts         [per-workspace token bucket]
│       ├── prompt-builder.ts       [system prompt + message builders]
│       ├── response-parser.ts      [parse + validate Claude outputs]
│       └── errors.ts               [AI-specific error handlers]
├── tests/
│   ├── unit/
│   │   ├── client.test.ts
│   │   ├── rate-limiter.test.ts
│   │   ├── prompt-builder.test.ts
│   │   └── response-parser.test.ts
│   └── integration/
│       └── health.test.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 5. Implementation

### 5.1 Anthropic Client Wrapper (`src/llm/client.ts`)

```typescript
// src/llm/client.ts
// Wraps the Anthropic SDK with:
// - Retry with exponential backoff (overload/rate-limit)
// - 30s timeout enforcement
// - Error normalization to AppError
// - Per-workspace API key override (fallback to env var)

import Anthropic from '@anthropic-ai/sdk'
import { AppError, ErrorCode, logger } from '@clickup/sdk'

// Model to use — Claude 3.5 Sonnet for cost/quality balance in self-hosted deployments
const DEFAULT_MODEL = 'claude-sonnet-4-5-20251001' as const

export interface LlmCallOptions {
  workspaceId: string
  apiKey?: string          // per-workspace key (future: loaded from DB); falls back to env
  maxTokens?: number       // default: 1024
  temperature?: number     // default: 0 (deterministic for structured outputs)
  systemPrompt?: string
  timeoutMs?: number       // default: 30_000
}

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
}

/**
 * Calls Claude with retry logic and error normalization.
 * This is the ONLY function in the codebase that calls the Anthropic API.
 * All AI capabilities (breakdown, summarize, etc.) call this.
 */
export async function callClaude(
  messages: LlmMessage[],
  options: LlmCallOptions,
): Promise<LlmResponse> {
  const apiKey = options.apiKey
    ?? process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    throw new AppError(ErrorCode.AI_NOT_CONFIGURED,
      'No Anthropic API key configured. Set ANTHROPIC_API_KEY in your environment.')
  }

  const client = new Anthropic({
    apiKey,
    timeout: options.timeoutMs ?? 30_000,
    maxRetries: 0, // We handle retries ourselves for full control
  })

  return await callWithRetry(client, messages, options)
}

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1_000

async function callWithRetry(
  client: Anthropic,
  messages: LlmMessage[],
  options: LlmCallOptions,
  attempt = 0,
): Promise<LlmResponse> {
  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0,
      system: options.systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    return {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    }

  } catch (err) {
    return await handleApiError(err, client, messages, options, attempt)
  }
}

async function handleApiError(
  err: unknown,
  client: Anthropic,
  messages: LlmMessage[],
  options: LlmCallOptions,
  attempt: number,
): Promise<LlmResponse> {
  // Anthropic SDK throws typed errors we can inspect
  if (err instanceof Anthropic.APIError) {
    // Failure mode 5: invalid/expired API key
    if (err.status === 401) {
      throw new AppError(ErrorCode.AI_AUTH_FAILED,
        'Anthropic API key is invalid or expired.')
    }

    // Failure mode 2: rate limited
    if (err.status === 429) {
      const retryAfter = parseInt(err.headers?.['retry-after'] ?? '5', 10)
      if (attempt < MAX_RETRIES) {
        logger.warn({ attempt, retryAfter }, 'Claude rate limited — retrying')
        await sleep(retryAfter * 1_000)
        return callWithRetry(client, messages, options, attempt + 1)
      }
      throw new AppError(ErrorCode.AI_RATE_LIMITED,
        `Claude rate limit exceeded. Retry after ${retryAfter}s.`)
    }

    // Failure mode 3: server overload (529 or 503)
    if (err.status === 529 || err.status === 503) {
      if (attempt < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        logger.warn({ attempt, backoff }, 'Claude overloaded — exponential backoff')
        await sleep(backoff)
        return callWithRetry(client, messages, options, attempt + 1)
      }
      throw new AppError(ErrorCode.AI_UNAVAILABLE,
        'Claude API is temporarily unavailable. Please try again later.')
    }
  }

  // Failure mode 4: timeout
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    throw new AppError(ErrorCode.AI_TIMEOUT,
      'Claude API request timed out after 30 seconds.')
  }

  // Unexpected error — log and rethrow
  logger.error({ err }, 'Unexpected Claude API error')
  throw new AppError(ErrorCode.AI_UNAVAILABLE, 'Unexpected AI service error.')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### 5.2 Per-Workspace Rate Limiter (`src/llm/rate-limiter.ts`)

```typescript
// src/llm/rate-limiter.ts
// Token bucket rate limiter per workspace.
// Prevents a single workspace from consuming all AI capacity.
//
// Limits (configurable via env):
//   AI_MAX_TOKENS_PER_MIN=100_000    (input + output tokens per workspace per minute)
//   AI_MAX_REQUESTS_PER_MIN=60       (requests per workspace per minute)
//
// Uses Redis for distributed state — works across multiple ai-service instances.

import { getRedis } from '@clickup/sdk'
import { AppError, ErrorCode } from '@clickup/sdk'

const MAX_TOKENS_PER_MIN = parseInt(process.env['AI_MAX_TOKENS_PER_MIN'] ?? '100000', 10)
const MAX_REQUESTS_PER_MIN = parseInt(process.env['AI_MAX_REQUESTS_PER_MIN'] ?? '60', 10)

/**
 * Checks if the workspace is within rate limits BEFORE calling Claude.
 * Throws AI_RATE_LIMITED if over limit.
 */
export async function checkAiRateLimit(workspaceId: string): Promise<void> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000) // 1-minute window
  const requestKey = `ai:ratelimit:req:${workspaceId}:${window}`

  const requestCount = await redis.incr(requestKey)
  if (requestCount === 1) await redis.expire(requestKey, 60)

  if (requestCount > MAX_REQUESTS_PER_MIN) {
    throw new AppError(ErrorCode.AI_RATE_LIMITED,
      `AI request limit of ${MAX_REQUESTS_PER_MIN}/min exceeded for this workspace.`)
  }
}

/**
 * Records token usage AFTER a successful Claude call.
 * For observability — token limit enforcement is a Wave 3 feature.
 */
export async function recordTokenUsage(
  workspaceId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000)
  const tokenKey = `ai:ratelimit:tokens:${workspaceId}:${window}`

  const total = inputTokens + outputTokens
  await redis.incrby(tokenKey, total)
  await redis.expire(tokenKey, 60)
}

/**
 * Returns current usage stats for a workspace (for /health or admin endpoints).
 */
export async function getAiUsageStats(workspaceId: string): Promise<{
  requestsThisMinute: number
  tokensThisMinute: number
}> {
  const redis = getRedis()
  const window = Math.floor(Date.now() / 60_000)

  const [requests, tokens] = await Promise.all([
    redis.get(`ai:ratelimit:req:${workspaceId}:${window}`),
    redis.get(`ai:ratelimit:tokens:${workspaceId}:${window}`),
  ])

  return {
    requestsThisMinute: parseInt(requests ?? '0', 10),
    tokensThisMinute: parseInt(tokens ?? '0', 10),
  }
}
```

### 5.3 Prompt Builder (`src/llm/prompt-builder.ts`)

```typescript
// src/llm/prompt-builder.ts
// Builds system prompts and user messages for each AI capability.
// All prompts are centralized here — never inline prompts in capability handlers.
//
// IMPORTANT: Prompts are carefully tuned. Do not modify without testing outputs.

export const SYSTEM_PROMPTS = {
  /**
   * Task breakdown: converts natural language descriptions into structured tasks.
   * Output must be valid JSON — enforced by response-parser.ts.
   */
  TASK_BREAKDOWN: `You are a project management assistant. Your job is to break down a task description into clear, actionable subtasks.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- Each subtask must have: title (string), description (string, optional), estimatedHours (number, optional)
- Maximum 10 subtasks
- Subtasks should be independently completable
- Use plain language — no jargon

Output format:
{
  "subtasks": [
    { "title": "...", "description": "...", "estimatedHours": 2 }
  ],
  "summary": "one-sentence summary of the overall task"
}`,

  /**
   * Summarization: condenses task/doc/comment thread content.
   */
  SUMMARIZE: `You are a concise summarization assistant. Summarize the provided content clearly.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- summary: 2-3 sentences maximum
- keyPoints: 3-5 bullet points (strings)
- actionItems: any explicit action items found (strings, empty array if none)

Output format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "actionItems": ["...", "..."]
}`,

  /**
   * Prioritization: orders tasks by impact and urgency.
   */
  PRIORITIZE: `You are a prioritization assistant. Given a list of tasks, determine their optimal order.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
- Return the same task IDs in recommended priority order
- Include a brief reason for the top 3 tasks
- Consider: deadlines, dependencies, impact, effort

Output format:
{
  "orderedTaskIds": ["id1", "id2", "id3"],
  "reasoning": {
    "id1": "highest impact, blocks other work",
    "id2": "deadline approaching",
    "id3": "quick win, frees up team"
  }
}`,

  /**
   * Daily planning: generates a realistic work schedule.
   */
  DAILY_PLAN: `You are a daily planning assistant. Create a realistic work plan for the day.

Rules:
- Output ONLY valid JSON — no markdown, no explanation  
- Respect capacity (availableHours) — do not over-schedule
- Flag overload if total estimated hours > availableHours * 1.2
- Group related tasks when possible
- Leave 20% buffer time (do not fill every hour)

Output format:
{
  "schedule": [
    { "taskId": "...", "title": "...", "estimatedHours": 1.5, "startTime": "09:00" }
  ],
  "totalScheduledHours": 6,
  "isOverloaded": false,
  "droppedTaskIds": [],
  "notes": "..."
}`,
} as const

/**
 * Builds the user message for task breakdown.
 */
export function buildTaskBreakdownMessage(input: {
  title: string
  description?: string
  context?: string
}): string {
  return [
    `Task: ${input.title}`,
    input.description ? `\nDescription: ${input.description}` : '',
    input.context ? `\nAdditional context: ${input.context}` : '',
    '\nBreak this down into subtasks.',
  ].join('')
}

/**
 * Builds the user message for summarization.
 */
export function buildSummarizeMessage(input: {
  content: string
  targetType: 'task' | 'doc' | 'thread'
}): string {
  return `Summarize this ${input.targetType}:\n\n${input.content}`
}

/**
 * Builds the user message for prioritization.
 */
export function buildPrioritizeMessage(input: {
  tasks: Array<{ id: string; title: string; description?: string; dueDate?: string; priority?: string }>
}): string {
  const taskList = input.tasks
    .map(t => `- ID: ${t.id} | ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`)
    .join('\n')

  return `Prioritize these ${input.tasks.length} tasks:\n\n${taskList}`
}

/**
 * Builds the user message for daily planning.
 */
export function buildDailyPlanMessage(input: {
  tasks: Array<{ id: string; title: string; estimatedHours?: number; priority?: string }>
  availableHours: number
  date: string
}): string {
  const taskList = input.tasks
    .map(t => `- ID: ${t.id} | ${t.title} | ~${t.estimatedHours ?? 1}h | priority: ${t.priority ?? 'none'}`)
    .join('\n')

  return `Create a daily plan for ${input.date}.\nAvailable hours: ${input.availableHours}\n\nTasks to schedule:\n${taskList}`
}
```

### 5.4 Response Parser (`src/llm/response-parser.ts`)

```typescript
// src/llm/response-parser.ts
// Parses and validates Claude's JSON output.
// Failure mode 6: if output is unparseable, logs and returns AI_INVALID_RESPONSE.

import { ZodTypeAny, z } from 'zod'
import { AppError, ErrorCode, logger } from '@clickup/sdk'

/**
 * Parses Claude's response as JSON and validates against a Zod schema.
 * If parsing fails: logs the raw response and throws AI_INVALID_RESPONSE.
 *
 * @param rawContent - The raw text from Claude's response
 * @param schema - The Zod schema the output must match
 * @param capability - Name of the AI capability (for logging)
 */
export function parseAiResponse<T>(
  rawContent: string,
  schema: ZodTypeAny,
  capability: string,
): T {
  // Claude sometimes wraps JSON in markdown code fences — strip them
  const cleaned = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    logger.error({ capability, rawContent, err }, 'Claude returned unparseable JSON')
    throw new AppError(ErrorCode.AI_INVALID_RESPONSE,
      `AI response for "${capability}" was not valid JSON.`)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    logger.error({ capability, parsed, issues: result.error.issues }, 'Claude response failed schema validation')
    throw new AppError(ErrorCode.AI_INVALID_RESPONSE,
      `AI response for "${capability}" did not match expected structure.`)
  }

  return result.data as T
}

// Zod schemas for each capability output
// These mirror the prompt output formats in prompt-builder.ts

export const TaskBreakdownOutputSchema = z.object({
  subtasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    estimatedHours: z.number().positive().optional(),
  })).max(10),
  summary: z.string(),
})

export const SummarizeOutputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(z.string()),
})

export const PrioritizeOutputSchema = z.object({
  orderedTaskIds: z.array(z.string()),
  reasoning: z.record(z.string(), z.string()),
})

export const DailyPlanOutputSchema = z.object({
  schedule: z.array(z.object({
    taskId: z.string(),
    title: z.string(),
    estimatedHours: z.number(),
    startTime: z.string(),
  })),
  totalScheduledHours: z.number(),
  isOverloaded: z.boolean(),
  droppedTaskIds: z.array(z.string()),
  notes: z.string().optional(),
})
```

### 5.5 AI Error Codes (add to @clickup/contracts errors.ts)

> **NOTE TO JULES:** The following ErrorCode values are ALREADY in `packages/contracts/src/errors.ts`.
> Do NOT modify that file. This section is reference only.

```typescript
// These are already in ErrorCode enum — READ ONLY:
AI_NOT_CONFIGURED    = 'AI_NOT_CONFIGURED'     // 422 — no API key
AI_RATE_LIMITED      = 'AI_RATE_LIMITED'        // 429 — rate limit hit
AI_UNAVAILABLE       = 'AI_UNAVAILABLE'         // 503 — Claude down
AI_TIMEOUT           = 'AI_TIMEOUT'             // 504 — request timed out
AI_AUTH_FAILED       = 'AI_AUTH_FAILED'         // 401 — bad API key
AI_INVALID_RESPONSE  = 'AI_INVALID_RESPONSE'    // 500 — unparseable output
```

### 5.6 Routes (`src/routes.ts`)

```typescript
// src/routes.ts
// Registers a placeholder route for each AI capability.
// The actual implementation comes in WO-026, WO-027, WO-028.
// This WO only registers the health endpoint + capability stubs.

import { Router } from 'express'
import { asyncHandler } from '@clickup/sdk'

export function createRoutes(): Router {
  const router = Router()

  // Health — required for Wave 1 gate smoke test
  // (actual health handler registered in index.ts via createHealthHandler)

  // AI capability stubs — implemented in WO-026/027/028
  // These return 501 until the capability WO is implemented
  const notImplemented = asyncHandler(async (_req, res) => {
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'AI capability not yet implemented', status: 501 } })
  })

  router.post('/api/v1/ai/task-breakdown', notImplemented)
  router.post('/api/v1/ai/summarize', notImplemented)
  router.post('/api/v1/ai/prioritize', notImplemented)
  router.post('/api/v1/ai/daily-plan', notImplemented)

  return router
}
```

### 5.7 .env.example

```
SERVICE_NAME=ai-service
PORT=3006
LOG_LEVEL=info

# Anthropic API (user brings their own key — this is the global fallback)
# Per-workspace keys are stored in DB (Wave 3 feature)
ANTHROPIC_API_KEY=sk-ant-...

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379

# AI rate limits per workspace per minute
AI_MAX_REQUESTS_PER_MIN=60
AI_MAX_TOKENS_PER_MIN=100000

# JWT (same secret across all services)
JWT_SECRET=change-me-in-production
```

---

## 6. Database Tables

This service has NO direct DB connection in Wave 2.
All data context is passed in the request body by the calling service.

In Wave 3, it will connect to read per-workspace AI configuration from:
- `workspaces.ai_config JSONB` (API key override, model preference, feature flags)

---

## 7. Mandatory Tests

### Unit Tests

```
□ callClaude: throws AI_NOT_CONFIGURED when no API key in env or options
□ callClaude: throws AI_AUTH_FAILED on Anthropic 401 response
□ callClaude: retries up to 3 times on 429 (rate limit), then throws AI_RATE_LIMITED
□ callClaude: retries with exponential backoff on 503/529, then throws AI_UNAVAILABLE
□ callClaude: throws AI_TIMEOUT on connection timeout
□ checkAiRateLimit: passes when under AI_MAX_REQUESTS_PER_MIN limit
□ checkAiRateLimit: throws AI_RATE_LIMITED when over limit
□ recordTokenUsage: increments Redis key correctly
□ parseAiResponse: returns typed data when Claude output is valid JSON
□ parseAiResponse: strips markdown code fences before parsing
□ parseAiResponse: throws AI_INVALID_RESPONSE when JSON is malformed
□ parseAiResponse: throws AI_INVALID_RESPONSE when JSON schema mismatch
□ buildTaskBreakdownMessage: includes title, description, and context
□ buildDailyPlanMessage: flags overload when hours exceed capacity
□ SYSTEM_PROMPTS: all prompts include "Output ONLY valid JSON" instruction
```

### Integration Tests

```
□ GET /health → 200 (service up, Redis connected)
□ POST /api/v1/ai/task-breakdown → 501 NOT_IMPLEMENTED (stub)
□ POST /api/v1/ai/summarize → 501 NOT_IMPLEMENTED (stub)
□ POST /api/v1/ai/prioritize → 501 NOT_IMPLEMENTED (stub)
□ POST /api/v1/ai/daily-plan → 501 NOT_IMPLEMENTED (stub)
□ POST any /ai/* without token → 401 AUTH_MISSING_TOKEN
```

---

## 8. Definition of Done

```
□ callClaude function handles all 6 failure modes correctly
□ Retry logic: 3 retries with exponential backoff for 503/529, respect retry-after for 429
□ Per-workspace rate limiting enforced via Redis
□ All prompts centralized in prompt-builder.ts (no inline prompts in handlers)
□ Response parser validates all 4 capability output schemas
□ pnpm typecheck passes
□ pnpm lint passes
□ All unit tests pass
□ Coverage ≥ 80% on llm/* files
□ GET /health returns 200
```

---

## 9. Constraints

```
✗ Do NOT call the Anthropic API in integration tests (mock client.ts instead)
✗ Do NOT hardcode model name in capability handlers — only in client.ts
✗ Do NOT implement actual capability logic here (that's WO-026, 027, 028)
✗ Do NOT store the Anthropic API key in the DB — it's an env var (until Wave 3)
✗ Do NOT use streaming responses yet — standard API call only (streaming is Wave 3)
✗ Do NOT add per-workspace DB queries — this service has no DB in Wave 2
✗ Do NOT retry on 401 or 422 — these are not transient errors
```

---

## 10. Allowed Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.39.0",
  "zod": "^3.22.0"
}
```
