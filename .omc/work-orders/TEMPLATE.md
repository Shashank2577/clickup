# Work Order — [SERVICE NAME]
**Wave:** [0 | 1 | 2 | 3 | 4]
**Session ID:** [WO-###]
**Depends on:** [List of WO-### that must be merged before this starts, or "none"]
**Branch name:** `wave[N]/[service-name]`
**Estimated time:** [1–2 hours]

---

## 1. Mission

One paragraph. What does this service do? What user problem does it solve?
Do NOT explain how to build it — that's what the rest of this document is for.

---

## 2. Context: How This Service Fits

```
[Draw a small ASCII diagram showing this service's position in the system]

Client → API Gateway → [THIS SERVICE] → PostgreSQL
                    ↘ NATS (publishes: event.name)
                    ↙ NATS (subscribes: event.name)
                    → [other-service] (HTTP calls)
```

---

## 3. Repository Setup

```bash
# From repo root:
cp -r services/_template services/[service-name]
cd services/[service-name]

# Rename package in package.json:
# "name": "@clickup/[service-name]"

# Set your .env:
cp .env.example .env
# Edit SERVICE_NAME=[service-name]
# Edit PORT=[assigned port — see port map below]
```

### Port Map (do not deviate)
| Service | Port |
|---------|------|
| api-gateway | 3000 |
| identity-service | 3001 |
| task-service | 3002 |
| comment-service | 3003 |
| docs-service | 3004 |
| file-service | 3005 |
| ai-service | 3006 |
| notification-service | 3007 |
| search-service | 3008 |

---

## 4. Files to Create

List every file this session creates. Do not create files not listed here.
Do not modify files in `packages/contracts` or `packages/sdk` — those are read-only.

```
services/[service-name]/
├── src/
│   ├── index.ts              [copy from _template, update SERVICE_NAME]
│   ├── routes.ts             [register all routes]
│   ├── [feature]/
│   │   ├── [feature].handler.ts    [Express route handlers]
│   │   ├── [feature].service.ts    [Business logic]
│   │   ├── [feature].repository.ts [DB queries only]
│   │   └── [feature].queries.ts    [SQL query strings]
│   └── [feature2]/
│       └── ...
├── tests/
│   ├── unit/
│   │   └── [feature].service.test.ts
│   └── integration/
│       └── [feature].handler.test.ts
├── package.json              [copy from _template, update name]
├── tsconfig.json             [copy from _template]
├── .env                      [from .env.example — do not commit]
└── .env.example              [copy from _template, update SERVICE_NAME + PORT]
```

---

## 5. Imports — What to Use from Shared Packages

```typescript
// FROM @clickup/contracts — import everything you need from here
import {
  // Types you will use:
  Task, User, Comment,           // entity types
  CreateTaskInput,               // Zod-inferred input types
  CreateTaskSchema,              // Zod schemas for validation
  ErrorCode,                     // error codes
  TASK_EVENTS,                   // event subject constants
  TaskCreatedEvent,              // event payload types
  Rooms,                         // WebSocket room builders
} from '@clickup/contracts'

// FROM @clickup/sdk — import infrastructure
import {
  requireAuth,           // JWT middleware
  AppError,              // error class
  asyncHandler,          // async route wrapper
  validate,              // input validation
  tier2Get, tier2Set,    // cache
  CacheKeys,             // cache key builders
  publish,               // NATS event publisher
  createDataLoader,      // batched DB queries
  logger,                // structured logger
  createServiceClient,   // HTTP client for service-to-service calls
} from '@clickup/sdk'

// NEVER import from other services' source directories
// NEVER use console.log — use logger
// NEVER throw raw Error — use AppError(ErrorCode.X)
// NEVER write custom validation — use validate(Schema, req.body)
```

---

## 6. Database Tables Available

> The schema already exists. Do NOT run CREATE TABLE.
> Do NOT alter columns or add indexes not already in the schema.

Tables this service reads/writes:

| Table | Access | Notes |
|-------|--------|-------|
| `table_name` | READ + WRITE | Description of usage |
| `other_table` | READ ONLY | Why you read it |

**Materialized path pattern** (if using tasks table):
```sql
-- Fetch task + all descendants (subtasks at any depth):
SELECT * FROM tasks
WHERE path LIKE $1 || '%'  -- $1 = parent task's path
  AND deleted_at IS NULL
ORDER BY path, position;

-- Compute path for new task:
-- Root task: '/{list_id}/{task_id}/'
-- Subtask:   parent.path || '{task_id}/'

-- NEVER use recursive CTEs for tree traversal — use path LIKE instead
```

---

## 7. API Endpoints to Implement

For each endpoint:
- Method + path
- Auth required?
- Request body schema (from @clickup/contracts)
- Success response shape
- Error codes to throw (from ErrorCode enum)

### 7.1 [Endpoint Name]
```
METHOD /path/:param

Auth: requireAuth middleware [yes/no]
Request body: [SchemaName from @clickup/contracts, or "none"]
```

**Success response** `HTTP 200/201`:
```json
{
  "data": { /* entity shape from @clickup/contracts entities.ts */ }
}
```

**Errors to throw:**
| Condition | ErrorCode |
|-----------|-----------|
| Resource not found | `ErrorCode.X_NOT_FOUND` |
| Unauthorized | `ErrorCode.AUTH_INSUFFICIENT_PERMISSION` |

**Query pattern** (copy this exactly — do not write your own):
```typescript
// Repository layer — no logic here, only SQL
const result = await db.query<Task>(`
  SELECT t.*, u.name as assignee_name
  FROM tasks t
  LEFT JOIN users u ON t.assignee_id = u.id
  WHERE t.id = $1
    AND t.deleted_at IS NULL
`, [taskId])
```

---

## 8. Events to Publish

After each mutation, publish the corresponding NATS event.
Use `publish()` from @clickup/sdk. Never publish inside a DB transaction.

```typescript
// Pattern: publish AFTER db write succeeds
await repository.createTask(task)
await publish(TASK_EVENTS.CREATED, {
  taskId: task.id,
  listId: task.listId,
  workspaceId: ctx.workspaceId,
  createdBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
} satisfies TaskCreatedEvent)
```

| Trigger | Event Subject | Payload Type |
|---------|--------------|--------------|
| Task created | `TASK_EVENTS.CREATED` | `TaskCreatedEvent` |
| Task updated | `TASK_EVENTS.UPDATED` | `TaskUpdatedEvent` |

---

## 9. Events to Subscribe To

If this service reacts to events from other services, subscribe on startup.

```typescript
// In src/index.ts bootstrap(), before app.listen():
await subscribe(TASK_EVENTS.COMPLETED, async (payload: TaskCompletedEvent) => {
  // handle the event
})
```

| Event Subject | Payload Type | What to Do |
|--------------|--------------|------------|
| `TASK_EVENTS.COMPLETED` | `TaskCompletedEvent` | Description |

---

## 10. Service-to-Service Calls

If this service needs data from another service:

```typescript
// Create client once at startup, pass through handlers
const identityClient = createServiceClient(
  process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  { traceId: req.headers['x-trace-id'] as string }
)

// Call the service
const { data } = await identityClient.get(`/api/v1/users/${userId}`)
```

| Service | Why | Endpoint |
|---------|-----|----------|
| identity-service | Verify workspace membership | `GET /api/v1/workspaces/:id/members/:userId` |

---

## 11. Caching Rules

Use the three-tier cache from @clickup/sdk. Rules for this service:

| Data | Cache Tier | Key | Invalidate When |
|------|-----------|-----|-----------------|
| Workspace members | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | `workspace.member_added` / `workspace.member_removed` |

```typescript
// Pattern: cache-aside
const cached = await tier2Get<WorkspaceMember[]>(CacheKeys.workspaceMembers(workspaceId))
if (cached !== null) return cached

const members = await repository.getMembers(workspaceId)
await tier2Set(CacheKeys.workspaceMembers(workspaceId), members)
return members
```

---

## 12. Mandatory Tests

Branch will NOT merge without all of these passing.

### 12.1 Unit Tests (`tests/unit/`)
Test the service layer in isolation. Mock the repository layer.

```
□ [Happy path description]
□ [Happy path description 2]
□ [Error: not found]
□ [Error: unauthorized]
□ [Error: validation failure]
□ [Edge case description]
```

### 12.2 Integration Tests (`tests/integration/`)
Test the full HTTP layer against a real DB. Do NOT mock the database.

```typescript
// Setup pattern for integration tests:
import { Pool } from 'pg'
import request from 'supertest'

const db = new Pool({ /* test DB config */ })

beforeEach(async () => {
  await db.query('BEGIN')
})

afterEach(async () => {
  await db.query('ROLLBACK') // clean state between tests
})
```

```
□ POST /endpoint → 201 with correct response shape
□ POST /endpoint with invalid body → 422 VALIDATION_INVALID_INPUT
□ GET /endpoint/:id that exists → 200 with entity
□ GET /endpoint/:id that doesn't exist → 404 X_NOT_FOUND
□ GET /endpoint/:id without auth → 401 AUTH_MISSING_TOKEN
□ GET /endpoint/:id in another workspace → 404 (not 403 — don't leak existence)
□ [Service-specific edge case]
□ [Service-specific edge case]
```

### 12.3 Contract Tests (`tests/contract/`)
Verify this service's responses match the OpenAPI contract schema.

```typescript
import { validateResponse } from '../helpers/contract-validator'

// Every test response must pass schema validation
expect(validateResponse('task', response.body.data)).toBe(true)
```

---

## 13. Definition of Done

Before opening a PR, verify ALL of these:

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass
□ Coverage ≥ 80% lines
□ GET /health returns 200 with all checks "ok"
□ All mandatory test scenarios implemented (Section 12)
□ No console.log in source code
□ No raw Error thrown — only AppError
□ No custom validation — only validate() from SDK
□ No DB queries outside repository files
□ No LLM/AI imports — call ai-service via HTTP only
□ .env is NOT committed (in .gitignore)
□ PR description explains what the service does
```

---

## 14. Constraints — What NOT to Do

These are hard rules. Violating any of them will cause the PR to be rejected.

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or migrations
✗ Do NOT add indexes not in 001_initial.sql
✗ Do NOT import from other services' src/ directories
✗ Do NOT call an LLM API directly — call ai-service via HTTP
✗ Do NOT use console.log — use logger from SDK
✗ Do NOT throw raw Error — use AppError(ErrorCode.X)
✗ Do NOT write custom validation logic — use validate(Schema, data)
✗ Do NOT use recursive CTEs for task tree queries — use path LIKE
✗ Do NOT write SQL inside handler or service files — only in repository files
✗ Do NOT add npm packages not listed in this work order
✗ Do NOT implement endpoints not listed in Section 7
```

---

## 15. Allowed Additional Dependencies

Only add these packages if needed for your specific service:

```json
[list any service-specific packages allowed, e.g. "bcrypt" for identity-service]
```
