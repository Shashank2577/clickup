# Work Order — AI Service: Capability Endpoints
**Wave:** 2
**Session ID:** WO-026
**Depends on:** WO-025 (ai-infrastructure) — must be merged to `main` before this branch is opened
**Branch name:** `wave2/ai-capabilities`
**Estimated time:** 2 hours

---

## 1. Mission

Add the four AI capability endpoints to the ai-service: task breakdown, content
summarization, task prioritization, and daily plan generation. WO-025 built the
infrastructure (Claude client, rate limiting, service scaffold); this WO wires it
up to real HTTP endpoints that users can call. Each endpoint accepts structured
input, calls Claude via the `callClaude()` function from WO-025, validates the
response, and returns typed output. This is the user-visible surface of the AI
feature — every AI action in the ClickUp OSS frontend goes through one of these
four routes.

---

## 2. Context: How This Fits

```
Client
  → API Gateway (:3000)
    → ai-service (:3006)                        [THIS WO adds 4 real handlers]
        POST /api/v1/ai/task-breakdown          [breakdown.handler.ts]
        POST /api/v1/ai/summarize               [summarize.handler.ts]
        POST /api/v1/ai/prioritize              [prioritize.handler.ts]
        POST /api/v1/ai/daily-plan              [daily-plan.handler.ts]

ai-service internal call chain (all 4 endpoints):
  handler → prompt builder → callClaude() [from WO-025 src/ai/claude.client.ts]
          → parse JSON response → validate schema → return { data: ... }

daily-plan only — additional HTTP call:
  → task-service (:3002)  GET /api/v1/users/:userId/tasks?status=incomplete&dueDate=:date

WO-025 files this WO READS (never modifies):
  src/ai/claude.client.ts         [callClaude function]
  src/middleware/rate-limiter.ts  [rate limiting middleware]
  src/routes.ts                   [will be updated — see Section 5.5]
```

---

## 3. Repository Setup

> **IMPORTANT:** Do NOT scaffold a new service. `services/ai-service/` already
> exists from WO-025. This WO only ADDS files inside it.

```bash
# From repo root — verify WO-025 files exist before starting:
ls services/ai-service/src/ai/claude.client.ts        # must exist
ls services/ai-service/src/middleware/rate-limiter.ts  # must exist
ls services/ai-service/src/routes.ts                  # must exist

# Branch from main (WO-025 already merged):
git checkout main
git pull
git checkout -b wave2/ai-capabilities
```

No new npm packages are needed. `@anthropic-ai/sdk` and all SDK/contracts
packages were installed by WO-025.

---

## 4. Files to Create or Modify

```
services/ai-service/src/
├── capabilities/                        [NEW directory]
│   ├── breakdown.handler.ts             [NEW — POST /api/v1/ai/task-breakdown]
│   ├── summarize.handler.ts             [NEW — POST /api/v1/ai/summarize]
│   ├── prioritize.handler.ts            [NEW — POST /api/v1/ai/prioritize]
│   └── daily-plan.handler.ts            [NEW — POST /api/v1/ai/daily-plan]
└── prompts/                             [NEW directory]
    ├── breakdown.prompt.ts              [NEW — buildBreakdownPrompt(input)]
    ├── summarize.prompt.ts              [NEW — buildSummarizePrompt(input)]
    ├── prioritize.prompt.ts             [NEW — buildPrioritizePrompt(input)]
    └── daily-plan.prompt.ts             [NEW — buildDailyPlanPrompt(input)]

services/ai-service/src/routes.ts       [MODIFY — replace stub routes with real routers]

tests/
├── unit/
│   ├── breakdown.handler.test.ts        [NEW]
│   ├── summarize.handler.test.ts        [NEW]
│   ├── prioritize.handler.test.ts       [NEW]
│   ├── daily-plan.handler.test.ts       [NEW]
│   ├── breakdown.prompt.test.ts         [NEW]
│   ├── summarize.prompt.test.ts         [NEW]
│   ├── prioritize.prompt.test.ts        [NEW]
│   └── daily-plan.prompt.test.ts        [NEW]
└── integration/
    └── capabilities.handler.test.ts     [NEW — mocks callClaude, real HTTP layer]
```

> **Do NOT touch:**
> - `src/ai/claude.client.ts` (WO-025 owns it)
> - `src/middleware/rate-limiter.ts` (WO-025 owns it)
> - Any file not listed above

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Input schemas (for validate())
  TaskBreakdownInputSchema,
  SummarizeInputSchema,
  PrioritizeInputSchema,
  DailyPlanInputSchema,

  // Output schemas (for JSON.parse validation)
  TaskBreakdownOutputSchema,
  SummarizeOutputSchema,
  PrioritizeOutputSchema,
  DailyPlanOutputSchema,

  // Input types (inferred from schemas)
  TaskBreakdownInput,
  SummarizeInput,
  PrioritizeInput,
  DailyPlanInput,

  // Output types
  TaskBreakdownOutput,
  SummarizeOutput,
  PrioritizeOutput,
  DailyPlanOutput,

  // Enum for summarize type discrimination
  SummarizeTargetType,

  // Error codes
  ErrorCode,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,          // JWT auth middleware
  asyncHandler,         // async route wrapper
  validate,             // input validation (throws VALIDATION_INVALID_INPUT on fail)
  AppError,             // error class
  logger,               // structured logger (never use console.log)
  createServiceClient,  // HTTP client for service-to-service calls
} from '@clickup/sdk'

// From WO-025 infrastructure (READ ONLY — never modify these files)
import { callClaude } from '../ai/claude.client'

// Prompt builders (defined in this WO's prompts/ directory)
import { buildBreakdownPrompt }  from '../prompts/breakdown.prompt'
import { buildSummarizePrompt }  from '../prompts/summarize.prompt'
import { buildPrioritizePrompt } from '../prompts/prioritize.prompt'
import { buildDailyPlanPrompt }  from '../prompts/daily-plan.prompt'
```

---

## 6. Database Tables

This service has NO direct database connection. All input data is passed in
request bodies. The daily-plan handler fetches task data via HTTP from
task-service (see Section 9).

---

## 7. Prompt Builders (`src/prompts/`)

All prompt builders follow the same pattern: accept a typed input object, return
a plain string that becomes the `user` message sent to Claude. The system prompt
is inlined in the handler (not in the prompt builder) to keep each file small and
single-purpose.

### 7.1 `src/prompts/breakdown.prompt.ts`

```typescript
import { TaskBreakdownInput } from '@clickup/contracts'

export function buildBreakdownPrompt(input: TaskBreakdownInput): string {
  const parts = [`Task to break down: ${input.input}`]

  if (input.context?.existingTasks?.length) {
    parts.push(`Existing tasks in this project: ${input.context.existingTasks.join(', ')}`)
  }
  if (input.context?.projectDescription) {
    parts.push(`Project context: ${input.context.projectDescription}`)
  }

  return parts.join('\n\n')
}
```

### 7.2 `src/prompts/summarize.prompt.ts`

```typescript
import { SummarizeInput, SummarizeTargetType } from '@clickup/contracts'

const TYPE_LABEL: Record<SummarizeTargetType, string> = {
  task:           'task description',
  comment_thread: 'comment thread',
  doc:            'document',
}

export function buildSummarizePrompt(input: SummarizeInput): string {
  const label = TYPE_LABEL[input.type]
  return `Please summarize the following ${label}:\n\n${input.content}`
}
```

### 7.3 `src/prompts/prioritize.prompt.ts`

```typescript
import { PrioritizeInput } from '@clickup/contracts'

export function buildPrioritizePrompt(input: PrioritizeInput): string {
  const taskList = input.tasks
    .map(t => {
      const parts = [`- ID: ${t.id} | Title: ${t.title}`]
      if (t.dueDate)          parts.push(`due: ${t.dueDate}`)
      if (t.estimatedMinutes) parts.push(`est: ${t.estimatedMinutes}m`)
      if (t.status)           parts.push(`status: ${t.status}`)
      return parts.join(' | ')
    })
    .join('\n')

  return `Please prioritize the following ${input.tasks.length} tasks:\n\n${taskList}`
}
```

### 7.4 `src/prompts/daily-plan.prompt.ts`

```typescript
import { DailyPlanInput } from '@clickup/contracts'

// tasks is the fetched list from task-service, not in DailyPlanInput itself
export function buildDailyPlanPrompt(
  input: DailyPlanInput,
  tasks: Array<{ id: string; title: string; estimatedMinutes?: number; status?: string }>,
): string {
  const availableMinutes = input.availableMinutes ?? 480
  const taskList = tasks
    .map(t => {
      const parts = [`- ID: ${t.id} | ${t.title}`]
      if (t.estimatedMinutes) parts.push(`~${t.estimatedMinutes}m`)
      if (t.status)           parts.push(`status: ${t.status}`)
      return parts.join(' | ')
    })
    .join('\n')

  return [
    `Create an optimal work plan for ${input.date}.`,
    `Available time: ${availableMinutes} minutes.`,
    `\nTasks to schedule:\n${taskList}`,
  ].join('\n')
}
```

---

## 8. API Endpoints to Implement

All four endpoints:
- Require `requireAuth` middleware
- Accept `POST` only
- Return `HTTP 200` with `{ data: <OutputType> }` on success
- Throw `AppError(ErrorCode.AI_INVALID_RESPONSE)` if Claude returns
  unparseable JSON or a response that fails schema validation

---

### 8.1 POST /api/v1/ai/task-breakdown

**File:** `src/capabilities/breakdown.handler.ts`

```typescript
import { Router } from 'express'
import {
  TaskBreakdownInputSchema,
  TaskBreakdownOutputSchema,
  TaskBreakdownOutput,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../ai/claude.client'
import { buildBreakdownPrompt } from '../prompts/breakdown.prompt'

const SYSTEM_PROMPT = `You are a project management AI. Break down the following task description into smaller, actionable subtasks. Return JSON matching this schema: { tasks: [{ title: string, description?: string, estimatedMinutes?: number, subtasks?: [{ title: string, estimatedMinutes?: number }] }] }`

export function createBreakdownRouter(): Router {
  const router = Router()

  router.post(
    '/api/v1/ai/task-breakdown',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(TaskBreakdownInputSchema, req.body)

      const messages = [{ role: 'user' as const, content: buildBreakdownPrompt(input) }]
      const response = await callClaude(messages, {
        apiKey:      process.env['ANTHROPIC_API_KEY'],
        model:       'claude-3-5-haiku-20241022',
        maxTokens:   2048,
        timeout:     30000,
        systemPrompt: SYSTEM_PROMPT,
      })

      let parsed: TaskBreakdownOutput
      try {
        parsed = JSON.parse(response.content) as TaskBreakdownOutput
        validate(TaskBreakdownOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for task-breakdown')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      return res.json({ data: parsed })
    }),
  )

  return router
}
```

**Request body** (`TaskBreakdownInputSchema`):
```typescript
{
  input:       string          // natural-language task description
  workspaceId: string          // UUID
  listId:      string          // UUID
  context?: {
    existingTasks?:      string[]  // titles of tasks already in the list
    projectDescription?: string
  }
}
```

**Success response** `HTTP 200`:
```json
{
  "data": {
    "tasks": [
      {
        "title": "Write unit tests",
        "description": "Cover the happy path and error cases",
        "estimatedMinutes": 60,
        "subtasks": [
          { "title": "Write happy-path test", "estimatedMinutes": 20 }
        ]
      }
    ]
  }
}
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| No auth token | `ErrorCode.AUTH_MISSING_TOKEN` (from `requireAuth`) |
| Invalid request body | `ErrorCode.VALIDATION_INVALID_INPUT` (from `validate`) |
| No Anthropic API key configured | `ErrorCode.AI_NOT_CONFIGURED` (from `callClaude`) |
| Claude rate limited | `ErrorCode.AI_RATE_LIMITED` (from `callClaude`) |
| Claude unavailable | `ErrorCode.AI_UNAVAILABLE` (from `callClaude`) |
| Claude timed out | `ErrorCode.AI_TIMEOUT` (from `callClaude`) |
| Invalid API key | `ErrorCode.AI_AUTH_FAILED` (from `callClaude`) |
| Claude returned bad JSON | `ErrorCode.AI_INVALID_RESPONSE` (thrown in handler) |

---

### 8.2 POST /api/v1/ai/summarize

**File:** `src/capabilities/summarize.handler.ts`

```typescript
import { Router } from 'express'
import {
  SummarizeInputSchema,
  SummarizeOutputSchema,
  SummarizeOutput,
  SummarizeTargetType,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../ai/claude.client'
import { buildSummarizePrompt } from '../prompts/summarize.prompt'

// System prompt varies by content type — discriminated at runtime
const SYSTEM_PROMPTS: Record<SummarizeTargetType, string> = {
  task:           'Summarize this task description concisely. Return JSON: { summary: string, keyPoints?: string[] }',
  comment_thread: 'Summarize this discussion thread, capturing the key decisions and open questions. Return JSON: { summary: string, keyPoints?: string[] }',
  doc:            'Summarize this document clearly. Return JSON: { summary: string, keyPoints?: string[] }',
}

export function createSummarizeRouter(): Router {
  const router = Router()

  router.post(
    '/api/v1/ai/summarize',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(SummarizeInputSchema, req.body)

      const messages = [{ role: 'user' as const, content: buildSummarizePrompt(input) }]
      const response = await callClaude(messages, {
        apiKey:       process.env['ANTHROPIC_API_KEY'],
        model:        'claude-3-5-haiku-20241022',
        maxTokens:    2048,
        timeout:      30000,
        systemPrompt: SYSTEM_PROMPTS[input.type],
      })

      let parsed: SummarizeOutput
      try {
        parsed = JSON.parse(response.content) as SummarizeOutput
        validate(SummarizeOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for summarize')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      return res.json({ data: parsed })
    }),
  )

  return router
}
```

**Request body** (`SummarizeInputSchema`):
```typescript
{
  content:     string               // raw text to summarize
  type:        SummarizeTargetType  // 'task' | 'comment_thread' | 'doc'
  workspaceId: string               // UUID
}
```

**Success response** `HTTP 200`:
```json
{
  "data": {
    "summary": "This task covers building the login flow...",
    "keyPoints": ["Covers email/password auth", "OAuth is out of scope"]
  }
}
```

**Errors:** Same table as Section 8.1 — all Claude errors propagate from `callClaude`; `AI_INVALID_RESPONSE` on bad parse.

---

### 8.3 POST /api/v1/ai/prioritize

**File:** `src/capabilities/prioritize.handler.ts`

```typescript
import { Router } from 'express'
import {
  PrioritizeInputSchema,
  PrioritizeOutputSchema,
  PrioritizeOutput,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger } from '@clickup/sdk'
import { callClaude } from '../ai/claude.client'
import { buildPrioritizePrompt } from '../prompts/prioritize.prompt'

const SYSTEM_PROMPT = `Given these tasks, return them in priority order (most important first) with reasoning. Return JSON: { ordered: [{ id: string, reasoning: string }] }`

export function createPrioritizeRouter(): Router {
  const router = Router()

  router.post(
    '/api/v1/ai/prioritize',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(PrioritizeInputSchema, req.body)

      const messages = [{ role: 'user' as const, content: buildPrioritizePrompt(input) }]
      const response = await callClaude(messages, {
        apiKey:       process.env['ANTHROPIC_API_KEY'],
        model:        'claude-3-5-haiku-20241022',
        maxTokens:    2048,
        timeout:      30000,
        systemPrompt: SYSTEM_PROMPT,
      })

      let parsed: PrioritizeOutput
      try {
        parsed = JSON.parse(response.content) as PrioritizeOutput
        validate(PrioritizeOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for prioritize')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      // Validate that Claude returned the same task IDs we sent — no extras, no missing
      const inputIds  = new Set(input.tasks.map(t => t.id))
      const outputIds = new Set(parsed.ordered.map(t => t.id))
      const inputIdsSorted  = [...inputIds].sort()
      const outputIdsSorted = [...outputIds].sort()
      const idsMatch =
        inputIdsSorted.length === outputIdsSorted.length &&
        inputIdsSorted.every((id, i) => id === outputIdsSorted[i])

      if (!idsMatch) {
        logger.error(
          { inputIds: [...inputIds], outputIds: [...outputIds] },
          'Claude returned mismatched task IDs for prioritize',
        )
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unexpected task IDs in priority response')
      }

      return res.json({ data: parsed })
    }),
  )

  return router
}
```

**Request body** (`PrioritizeInputSchema`):
```typescript
{
  tasks: Array<{
    id:                string   // UUID
    title:             string
    dueDate?:          string   // ISO date 'YYYY-MM-DD'
    estimatedMinutes?: number
    status?:           string
  }>
  workspaceId: string            // UUID
  userId:      string            // UUID
}
```

**Success response** `HTTP 200`:
```json
{
  "data": {
    "ordered": [
      { "id": "task-uuid-1", "reasoning": "Blocks other work and deadline is tomorrow" },
      { "id": "task-uuid-2", "reasoning": "High impact, relatively quick" }
    ]
  }
}
```

**ID validation rule:** The set of `id` values in `parsed.ordered` must exactly
match the set of `id` values in `input.tasks`. If they differ (extra IDs, missing
IDs, or count mismatch), throw `AppError(ErrorCode.AI_INVALID_RESPONSE)`.

**Errors:** Same table as Section 8.1 plus `AI_INVALID_RESPONSE` on ID mismatch.

---

### 8.4 POST /api/v1/ai/daily-plan

**File:** `src/capabilities/daily-plan.handler.ts`

This endpoint fetches today's tasks from task-service before calling Claude.

```typescript
import { Router } from 'express'
import {
  DailyPlanInputSchema,
  DailyPlanOutputSchema,
  DailyPlanOutput,
  ErrorCode,
} from '@clickup/contracts'
import { requireAuth, asyncHandler, validate, AppError, logger, createServiceClient } from '@clickup/sdk'
import { callClaude } from '../ai/claude.client'
import { buildDailyPlanPrompt } from '../prompts/daily-plan.prompt'

const SYSTEM_PROMPT = `Given these tasks and the available minutes today, create an optimal work plan. Return JSON: { plan: [{ taskId: string, taskTitle: string, suggestedStartTime?: string, estimatedMinutes: number, reasoning: string }], totalMinutes: number, overloadWarning?: string }`

export function createDailyPlanRouter(): Router {
  const router = Router()

  router.post(
    '/api/v1/ai/daily-plan',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(DailyPlanInputSchema, req.body)

      // Fetch today's incomplete tasks for the user from task-service
      const taskClient = createServiceClient(
        process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002',
        { traceId: req.headers['x-trace-id'] as string | undefined },
      )
      const { data: tasks } = await taskClient.get<Array<{
        id:                string
        title:             string
        estimatedMinutes?: number
        status?:           string
      }>>(
        `/api/v1/users/${input.userId}/tasks?status=incomplete&dueDate=${input.date}`,
      )

      const messages = [{ role: 'user' as const, content: buildDailyPlanPrompt(input, tasks ?? []) }]
      const response = await callClaude(messages, {
        apiKey:       process.env['ANTHROPIC_API_KEY'],
        model:        'claude-3-5-haiku-20241022',
        maxTokens:    2048,
        timeout:      30000,
        systemPrompt: SYSTEM_PROMPT,
      })

      let parsed: DailyPlanOutput
      try {
        parsed = JSON.parse(response.content) as DailyPlanOutput
        validate(DailyPlanOutputSchema, parsed)
      } catch (err) {
        logger.error({ err, raw: response.content }, 'Claude returned unparseable JSON for daily-plan')
        throw new AppError(ErrorCode.AI_INVALID_RESPONSE, 'Claude returned unparseable JSON')
      }

      return res.json({ data: parsed })
    }),
  )

  return router
}
```

**Request body** (`DailyPlanInputSchema`):
```typescript
{
  userId:            string  // UUID
  workspaceId:       string  // UUID
  date:              string  // 'YYYY-MM-DD'
  availableMinutes?: number  // default 480 (8 hours) if omitted
}
```

**Success response** `HTTP 200`:
```json
{
  "data": {
    "plan": [
      {
        "taskId": "task-uuid-1",
        "taskTitle": "Implement login page",
        "suggestedStartTime": "09:00",
        "estimatedMinutes": 90,
        "reasoning": "Highest priority; blocks the auth flow"
      }
    ],
    "totalMinutes": 360,
    "overloadWarning": "You have 120 minutes of tasks beyond your available time"
  }
}
```

**Errors:** Same table as Section 8.1. If task-service is unavailable, the
`createServiceClient` call will throw — let it propagate (gateway will return
502). Do not swallow the error with a fallback empty list.

---

## 9. Service-to-Service Calls

Only the daily-plan endpoint makes outbound service calls.

```typescript
// src/capabilities/daily-plan.handler.ts — inside the request handler

const taskClient = createServiceClient(
  process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002',
  { traceId: req.headers['x-trace-id'] as string | undefined },
)

const { data: tasks } = await taskClient.get(
  `/api/v1/users/${input.userId}/tasks?status=incomplete&dueDate=${input.date}`,
)
```

Add the following to `services/ai-service/.env.example` (append — do not
replace the existing file):

```
# task-service URL (for daily-plan endpoint)
TASK_SERVICE_URL=http://localhost:3002
```

| Service | Why | Endpoint |
|---------|-----|----------|
| task-service | Fetch today's incomplete tasks for the user | `GET /api/v1/users/:userId/tasks?status=incomplete&dueDate=:date` |

---

## 10. Update routes.ts

Replace the four `notImplemented` stub routes in `src/routes.ts` with real
routers. Existing `GET /health` registration (in `index.ts` or inline in
`routes.ts`) must be left untouched.

```typescript
// src/routes.ts — MODIFIED from WO-025 version
import { Router } from 'express'
import { createBreakdownRouter }  from './capabilities/breakdown.handler'
import { createSummarizeRouter }  from './capabilities/summarize.handler'
import { createPrioritizeRouter } from './capabilities/prioritize.handler'
import { createDailyPlanRouter }  from './capabilities/daily-plan.handler'

export function createRoutes(): Router {
  const router = Router()

  router.use(createBreakdownRouter())
  router.use(createSummarizeRouter())
  router.use(createPrioritizeRouter())
  router.use(createDailyPlanRouter())

  return router
}
```

> **NOTE TO JULES:** The original `routes.ts` from WO-025 has `notImplemented`
> stubs for all four routes. Replace the **entire file** with the version above.
> Do not keep the `notImplemented` stubs — they will conflict with the real routes.

---

## 11. Mandatory Tests

Branch will NOT merge without all of these passing. `callClaude` must be mocked
in all tests — never call the real Anthropic API.

### 11.1 Unit Tests — Prompt Builders (`tests/unit/`)

```
breakdown.prompt.test.ts
□ buildBreakdownPrompt: includes input.input in returned string
□ buildBreakdownPrompt: includes existingTasks when provided
□ buildBreakdownPrompt: includes projectDescription when provided
□ buildBreakdownPrompt: omits context block when context is undefined
□ buildBreakdownPrompt: omits existingTasks block when array is empty

summarize.prompt.test.ts
□ buildSummarizePrompt: labels content as 'task description' for type 'task'
□ buildSummarizePrompt: labels content as 'comment thread' for type 'comment_thread'
□ buildSummarizePrompt: labels content as 'document' for type 'doc'
□ buildSummarizePrompt: includes the full content string in output

prioritize.prompt.test.ts
□ buildPrioritizePrompt: includes all task IDs in output
□ buildPrioritizePrompt: includes dueDate when provided
□ buildPrioritizePrompt: includes estimatedMinutes when provided
□ buildPrioritizePrompt: includes status when provided
□ buildPrioritizePrompt: omits optional fields when not provided
□ buildPrioritizePrompt: shows correct task count in output

daily-plan.prompt.test.ts
□ buildDailyPlanPrompt: includes date in output
□ buildDailyPlanPrompt: uses 480 when availableMinutes is undefined
□ buildDailyPlanPrompt: uses provided availableMinutes value
□ buildDailyPlanPrompt: lists all fetched task IDs and titles
□ buildDailyPlanPrompt: handles empty task list gracefully
```

### 11.2 Unit Tests — Handlers (`tests/unit/`)

Mock `callClaude` to return controlled responses.

```
breakdown.handler.test.ts
□ returns { data: TaskBreakdownOutput } when Claude returns valid JSON
□ throws AI_INVALID_RESPONSE when Claude returns non-JSON string
□ throws AI_INVALID_RESPONSE when Claude returns JSON that fails TaskBreakdownOutputSchema
□ propagates AI_NOT_CONFIGURED from callClaude (no try/catch around callClaude)
□ propagates AI_RATE_LIMITED from callClaude
□ propagates AI_TIMEOUT from callClaude
□ returns 401 when no auth token provided (requireAuth blocks request)
□ returns 422 VALIDATION_INVALID_INPUT when body is missing required fields

summarize.handler.test.ts
□ returns { data: SummarizeOutput } for type 'task'
□ returns { data: SummarizeOutput } for type 'comment_thread'
□ returns { data: SummarizeOutput } for type 'doc'
□ selects correct system prompt per type (assert via callClaude mock call args)
□ throws AI_INVALID_RESPONSE on bad JSON parse
□ throws AI_INVALID_RESPONSE when JSON fails SummarizeOutputSchema
□ returns 401 without auth token
□ returns 422 when body missing required fields

prioritize.handler.test.ts
□ returns { data: PrioritizeOutput } when Claude returns valid JSON with matching IDs
□ throws AI_INVALID_RESPONSE when Claude returns extra IDs not in input
□ throws AI_INVALID_RESPONSE when Claude returns fewer IDs than input
□ throws AI_INVALID_RESPONSE when Claude returns different IDs entirely
□ throws AI_INVALID_RESPONSE on bad JSON parse
□ throws AI_INVALID_RESPONSE when JSON fails PrioritizeOutputSchema
□ returns 401 without auth token
□ returns 422 when tasks array is empty or missing

daily-plan.handler.test.ts
□ calls task-service with correct userId and date query params
□ returns { data: DailyPlanOutput } when Claude returns valid JSON
□ passes fetched tasks to buildDailyPlanPrompt (assert via prompt mock or callClaude args)
□ uses default 480 availableMinutes when input.availableMinutes is undefined
□ throws AI_INVALID_RESPONSE on bad JSON parse
□ throws AI_INVALID_RESPONSE when JSON fails DailyPlanOutputSchema
□ propagates task-service HTTP error (does not swallow it)
□ returns 401 without auth token
□ returns 422 when body missing required fields
```

### 11.3 Integration Tests — `tests/integration/capabilities.handler.test.ts`

Use a real Express app instance. Mock `callClaude` at the module level (do NOT
call the real Anthropic API). Mock `createServiceClient` for daily-plan tests.

```typescript
// Setup pattern
import request from 'supertest'
import { app } from '../../src/index'

jest.mock('../../src/ai/claude.client', () => ({
  callClaude: jest.fn(),
}))
jest.mock('@clickup/sdk', () => ({
  ...jest.requireActual('@clickup/sdk'),
  createServiceClient: jest.fn(),
}))

const { callClaude } = require('../../src/ai/claude.client')
```

```
□ POST /api/v1/ai/task-breakdown → 200 with { data: TaskBreakdownOutput } shape
□ POST /api/v1/ai/task-breakdown without auth → 401
□ POST /api/v1/ai/task-breakdown with missing body fields → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/ai/task-breakdown when callClaude returns bad JSON → 500 AI_INVALID_RESPONSE

□ POST /api/v1/ai/summarize → 200 with { data: SummarizeOutput } shape
□ POST /api/v1/ai/summarize without auth → 401
□ POST /api/v1/ai/summarize with invalid type → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/ai/summarize when callClaude returns bad JSON → 500 AI_INVALID_RESPONSE

□ POST /api/v1/ai/prioritize → 200 with { data: PrioritizeOutput } shape
□ POST /api/v1/ai/prioritize without auth → 401
□ POST /api/v1/ai/prioritize when Claude returns wrong IDs → 500 AI_INVALID_RESPONSE

□ POST /api/v1/ai/daily-plan → 200 with { data: DailyPlanOutput } shape (task-service mocked)
□ POST /api/v1/ai/daily-plan without auth → 401
□ POST /api/v1/ai/daily-plan when callClaude returns bad JSON → 500 AI_INVALID_RESPONSE

□ GET /health → 200 (WO-025 health endpoint still works — do not break it)
```

---

## 12. Definition of Done

```
□ pnpm typecheck — zero errors (run from services/ai-service/)
□ pnpm lint — zero warnings (run from services/ai-service/)
□ pnpm test — all unit and integration tests pass
□ All 4 endpoints return the correct response shape for a valid request
□ AI_INVALID_RESPONSE is thrown when Claude returns malformed JSON for all 4 endpoints
□ Prioritize endpoint throws AI_INVALID_RESPONSE when returned task IDs do not match input
□ Daily-plan endpoint calls task-service with the correct userId and date parameters
□ GET /health still returns 200 (WO-025 health endpoint must not be broken)
□ No console.log anywhere in src/ — use logger from @clickup/sdk
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No manual/custom validation — only validate(Schema, data) from SDK
□ callClaude is NEVER called directly from tests (always mocked)
□ The real Anthropic API is NEVER called in any test
□ src/ai/claude.client.ts is unchanged from WO-025
□ src/middleware/rate-limiter.ts is unchanged from WO-025
□ TASK_SERVICE_URL added to .env.example (do not commit .env)
□ PR description: "AI Service: task breakdown, summarize, prioritize, and daily-plan endpoints"
```

---

## 13. Constraints

```
✗ NEVER call the Anthropic API directly — ALWAYS use callClaude() from WO-025
✗ NEVER modify src/ai/claude.client.ts (owned by WO-025)
✗ NEVER modify src/middleware/rate-limiter.ts (owned by WO-025)
✗ NEVER add new npm packages — all dependencies were installed by WO-025
✗ NEVER implement user-facing auth — use requireAuth from SDK only
✗ NEVER use console.log — use logger from @clickup/sdk
✗ NEVER throw raw Error — always throw AppError(ErrorCode.X)
✗ NEVER write custom validation — use validate(Schema, data) from SDK
✗ NEVER call the real Anthropic API in tests — mock callClaude
✗ NEVER swallow task-service errors in daily-plan — let them propagate
✗ NEVER add inline prompt strings in handlers — use prompt builders from src/prompts/
✗ NEVER use the claude-sonnet model — use claude-3-5-haiku-20241022 for all 4 endpoints
✗ Do NOT add new DB connections — this service has no direct DB access in Wave 2
✗ Do NOT implement endpoints beyond the 4 listed in Section 8
✗ Do NOT modify packages/contracts or packages/sdk
```

---

## 14. Allowed Dependencies

No new packages. All of the following are already installed by WO-025:

```json
{
  "@anthropic-ai/sdk": "^0.39.0",
  "@clickup/contracts": "workspace:*",
  "@clickup/sdk": "workspace:*",
  "express": "^4.18.0",
  "zod": "^3.22.0"
}
```
