# Work Order — Time Tracking Service
**Wave:** 3
**Session ID:** WO-016
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-005 (task-service)
**Branch name:** `wave3/time-tracking`
**Estimated time:** 2 hours

---

## 1. Mission

The Time Tracking Service owns the `time_entries` table and provides the API for
logging, viewing, editing, and deleting time worked against tasks. Users log how
many minutes they spent on a task, whether it was billable, and a note. Managers
can query entries by task, by user, or within a date range. The service also exposes
a per-task summary endpoint that aggregates total billable and non-billable minutes —
this summary is cached for five minutes and invalidated whenever an entry is created,
updated, or deleted for that task. Users may only edit or delete their own time
entries unless they are a workspace owner or admin.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → time-tracking-service (:3011)
      → PostgreSQL (table: time_entries)
      → identity-service (:3001) HTTP: verify workspace membership + role check
      → task-service (:3002) HTTP: verify task exists + get workspaceId
      ← NATS subscribes: (none in this wave)
      ↘ NATS publishes: (none in this wave)
      → Redis: cache time-summary per taskId (Tier 3, 5-min TTL)
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/time-tracking-service
cd services/time-tracking-service

# In package.json change:
# "name": "@clickup/time-tracking-service"

cp .env.example .env
# Edit: SERVICE_NAME=time-tracking-service
# Edit: PORT=3011
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
# Edit: TASK_SERVICE_URL=http://localhost:3002
```

---

## 4. Files to Create

```
services/time-tracking-service/
├── src/
│   ├── index.ts                            [copy _template, SERVICE_NAME=time-tracking-service]
│   ├── routes.ts                           [register all routes]
│   └── time-entries/
│       ├── time-entries.handler.ts         [HTTP handlers — no SQL, no business logic]
│       ├── time-entries.service.ts         [business logic, auth checks, cache management]
│       └── time-entries.repository.ts      [all DB queries — no business logic here]
├── tests/
│   ├── unit/
│   │   └── time-entries.service.test.ts    [mock repository, test logic in isolation]
│   └── integration/
│       └── time-entries.handler.test.ts    [real DB via transaction rollback, test HTTP layer]
├── package.json                            [name: @clickup/time-tracking-service]
├── tsconfig.json                           [extend ../../tsconfig.base.json]
├── .env.example
└── .env                                    [NOT committed]
```

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Entity types
  TimeEntry,
  // Schemas (for validate() — never write manual validation)
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  TimeEntryQuerySchema,
  // Error codes
  ErrorCode,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,
  asyncHandler,
  validate,
  AppError,
  logger,
  createServiceClient,
  tier3Get,
  tier3Set,
  tier3Del,
  CacheKeys,
} from '@clickup/sdk'
```

> **Note:** `CreateTimeEntrySchema`, `UpdateTimeEntrySchema`, and `TimeEntryQuerySchema`
> must be defined in `packages/contracts`. If they do not exist yet, they will be added
> by the contracts work order. Do NOT create them yourself. Use them via import and if
> they are missing, file a blocking note in your PR.

---

## 6. Database Tables

The `time_entries` table already exists in `001_initial.sql`. Do NOT generate
migrations or CREATE TABLE statements.

| Table | Access | Notes |
|-------|--------|-------|
| `time_entries` | READ + WRITE | Core entity; no soft-delete (hard delete is OK) |
| `tasks` | READ ONLY | Verify task exists + join to get workspace_id |
| `lists` | READ ONLY | Join to get space_id from task |
| `spaces` | READ ONLY | Join to get workspace_id from list |
| `users` | READ ONLY | JOIN for user name on list queries |
| `workspace_members` | READ ONLY | Role check for cross-user edit/delete |

### Schema reference for time_entries (do not recreate — for column names only)

```sql
-- time_entries
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id)
minutes     INTEGER NOT NULL CHECK (minutes > 0)
billable    BOOLEAN NOT NULL DEFAULT FALSE
note        TEXT
started_at  TIMESTAMPTZ NOT NULL
ended_at    TIMESTAMPTZ NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
CHECK (ended_at > started_at)
```

### Standard time entry list query (copy this — do not write your own)

```sql
-- Use for GET /time-entries list endpoint
SELECT
  te.*,
  u.id         AS user_id,
  u.name       AS user_name,
  u.avatar_url AS user_avatar
FROM time_entries te
JOIN users u ON u.id = te.user_id
WHERE te.task_id    = COALESCE($1, te.task_id)       -- filter by taskId if provided
  AND te.user_id    = COALESCE($2, te.user_id)       -- filter by userId if provided
  AND te.started_at >= COALESCE($3, te.started_at)   -- filter by from date if provided
  AND te.started_at <= COALESCE($4, te.ended_at)     -- filter by to date if provided
ORDER BY te.started_at DESC
LIMIT $5 OFFSET $6
```

### Task + workspaceId lookup query

```sql
-- Resolve workspaceId from taskId — use in service layer, not handler
SELECT
  t.id         AS task_id,
  s.workspace_id
FROM tasks  t
JOIN lists  l ON l.id = t.list_id
JOIN spaces s ON s.id = l.space_id
WHERE t.id = $1
  AND t.deleted_at IS NULL
```

### Time summary query

```sql
-- Use for GET /tasks/:taskId/time-summary
SELECT
  SUM(CASE WHEN billable = TRUE  THEN minutes ELSE 0 END) AS billable_minutes,
  SUM(CASE WHEN billable = FALSE THEN minutes ELSE 0 END) AS non_billable_minutes,
  SUM(minutes) AS total_minutes,
  COUNT(*)     AS entry_count
FROM time_entries
WHERE task_id = $1
```

---

## 7. API Endpoints

All routes registered in `routes.ts`. All handlers use `asyncHandler()`. All body
parsing uses `validate(Schema, req.body)` — no manual validation.

---

### 7.1 Create Time Entry

```
POST /api/v1/time-entries
Auth: requireAuth
Body: CreateTimeEntrySchema {
  taskId:    string (UUID),
  minutes:   number (integer, > 0),
  billable?: boolean (default false),
  note?:     string,
  startedAt: string (ISO 8601),
  endedAt:   string (ISO 8601)
}
```

**Handler steps (in time-entries.service.ts):**

1. Call `validate(CreateTimeEntrySchema, req.body)`.
2. Verify `endedAt > startedAt`:
   ```typescript
   if (new Date(input.endedAt) <= new Date(input.startedAt)) {
     throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'endedAt must be after startedAt')
   }
   ```
3. Look up task + workspaceId:
   ```typescript
   const task = await timeEntriesRepository.getTaskWithWorkspace(input.taskId)
   if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)
   ```
4. Verify workspace membership via identity-service (Section 10).
5. Insert the entry:
   ```sql
   INSERT INTO time_entries (task_id, user_id, minutes, billable, note, started_at, ended_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING *
   ```
   Set `user_id = req.auth.userId`.
6. Invalidate the time-summary cache for this task:
   ```typescript
   await tier3Del(`time-summary:${input.taskId}`)
   ```
7. Return `HTTP 201` with `{ data: timeEntry }`.

**Success** `HTTP 201`:
```json
{
  "data": {
    "id":        "uuid",
    "taskId":    "uuid",
    "userId":    "uuid",
    "minutes":   90,
    "billable":  true,
    "note":      "Pair programming session",
    "startedAt": "2026-04-19T09:00:00Z",
    "endedAt":   "2026-04-19T10:30:00Z",
    "createdAt": "2026-04-19T10:30:05Z"
  }
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Task not found | `ErrorCode.TASK_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| endedAt <= startedAt | `ErrorCode.VALIDATION_INVALID_INPUT` |
| minutes < 1 | `ErrorCode.VALIDATION_INVALID_INPUT` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.2 List Time Entries

```
GET /api/v1/time-entries
Auth: requireAuth
Query params: TimeEntryQuerySchema {
  taskId?:  string (UUID) — filter by task
  userId?:  string (UUID) — filter by user
  from?:    string (ISO 8601 date) — started_at >=
  to?:      string (ISO 8601 date) — started_at <=
  page?:    number (default 1)
  pageSize?: number (default 50, max 200)
}
```

**Handler steps:**

1. Call `validate(TimeEntryQuerySchema, req.query)`.
2. Resolve `workspaceId`: if `taskId` is provided, look up the task's workspace and
   verify membership. If only `userId` is provided, require the caller to also provide
   a `workspaceId` query param (or look it up via identity-service). For simplicity
   in this wave: require at least one of `taskId` or `userId` to be present; if
   neither is given, return `422 VALIDATION_INVALID_INPUT`.
3. If the caller is NOT a workspace owner/admin, they may only see their own entries:
   ```typescript
   const { data: member } = await identityClient.get(
     `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
   )
   if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

   const isAdminOrOwner = ['owner', 'admin'].includes(member.role)
   if (!isAdminOrOwner && input.userId && input.userId !== req.auth.userId) {
     throw new AppError(ErrorCode.AUTH_FORBIDDEN)
   }
   // Non-admins always scope to their own entries
   const effectiveUserId = isAdminOrOwner ? (input.userId ?? null) : req.auth.userId
   ```
4. Execute the list query (Section 6).
5. Return `HTTP 200`:
   ```json
   {
     "data":     [ /* TimeEntry[] */ ],
     "total":    42,
     "page":     1,
     "pageSize": 50,
     "hasMore":  false
   }
   ```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Neither taskId nor userId provided | `ErrorCode.VALIDATION_INVALID_INPUT` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| Non-admin requesting another user's entries | `ErrorCode.AUTH_FORBIDDEN` |

---

### 7.3 Update Time Entry

```
PATCH /api/v1/time-entries/:entryId
Auth: requireAuth
Body: UpdateTimeEntrySchema {
  minutes?:   number (integer, > 0),
  billable?:  boolean,
  note?:      string,
  startedAt?: string (ISO 8601),
  endedAt?:   string (ISO 8601)
}
```

**Handler steps:**

1. Call `validate(UpdateTimeEntrySchema, req.body)`.
2. Fetch the entry:
   ```sql
   SELECT te.*, s.workspace_id
   FROM time_entries te
   JOIN tasks  t ON t.id = te.task_id
   JOIN lists  l ON l.id = t.list_id
   JOIN spaces s ON s.id = l.space_id
   WHERE te.id = $1
   ```
3. If not found: `throw new AppError(ErrorCode.TIME_ENTRY_NOT_FOUND)`.
4. **Authorization check** — user can edit their own entry; workspace owner/admin can edit any:
   ```typescript
   const isOwner = entry.userId === req.auth.userId
   if (!isOwner) {
     const { data: member } = await identityClient.get(
       `/api/v1/workspaces/${entry.workspaceId}/members/${req.auth.userId}`
     )
     if (!member || !['owner', 'admin'].includes(member.role)) {
       throw new AppError(ErrorCode.AUTH_FORBIDDEN)
     }
   }
   ```
5. Validate date ordering if both dates provided or one is updated:
   ```typescript
   const newStartedAt = input.startedAt ? new Date(input.startedAt) : new Date(entry.startedAt)
   const newEndedAt   = input.endedAt   ? new Date(input.endedAt)   : new Date(entry.endedAt)
   if (newEndedAt <= newStartedAt) {
     throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'endedAt must be after startedAt')
   }
   ```
6. Update via repository:
   ```sql
   UPDATE time_entries
   SET minutes    = COALESCE($2, minutes),
       billable   = COALESCE($3, billable),
       note       = COALESCE($4, note),
       started_at = COALESCE($5, started_at),
       ended_at   = COALESCE($6, ended_at)
   WHERE id = $1
   RETURNING *
   ```
7. Invalidate time-summary cache: `await tier3Del(`time-summary:${entry.taskId}`)`.
8. Return `HTTP 200` with `{ data: updatedEntry }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Entry not found | `ErrorCode.TIME_ENTRY_NOT_FOUND` |
| User is not owner and not admin | `ErrorCode.AUTH_FORBIDDEN` |
| endedAt <= startedAt after merge | `ErrorCode.VALIDATION_INVALID_INPUT` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.4 Delete Time Entry

```
DELETE /api/v1/time-entries/:entryId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the entry (same JOIN query as 7.3 step 2).
2. If not found: `throw new AppError(ErrorCode.TIME_ENTRY_NOT_FOUND)`.
3. Same authorization check as 7.3 step 4.
4. Hard-delete (time_entries has no `deleted_at` column):
   ```sql
   DELETE FROM time_entries WHERE id = $1
   ```
5. Invalidate time-summary cache: `await tier3Del(`time-summary:${entry.taskId}`)`.
6. Return `HTTP 204` with no body.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Entry not found | `ErrorCode.TIME_ENTRY_NOT_FOUND` |
| User is not owner and not admin | `ErrorCode.AUTH_FORBIDDEN` |

---

### 7.5 Get Task Time Summary

```
GET /api/v1/tasks/:taskId/time-summary
Auth: requireAuth
```

**Handler steps:**

1. Look up the task + workspaceId:
   ```typescript
   const task = await timeEntriesRepository.getTaskWithWorkspace(taskId)
   if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)
   ```
2. Verify workspace membership.
3. **Cache-aside pattern** (5-minute TTL, Tier 3):
   ```typescript
   const cacheKey = `time-summary:${taskId}`
   const cached = await tier3Get<TimeSummary>(cacheKey)
   if (cached !== null) return res.json({ data: cached })

   const summary = await timeEntriesRepository.getTimeSummary(taskId)
   await tier3Set(cacheKey, summary, 300)  // 300 seconds = 5 minutes
   return res.json({ data: summary })
   ```

**Response shape:**

```typescript
{
  taskId:              string
  billableMinutes:     number
  nonBillableMinutes:  number
  totalMinutes:        number
  entryCount:          number
}
```

**Example:**
```json
{
  "data": {
    "taskId":             "550e8400-e29b-41d4-a716-446655440000",
    "billableMinutes":    180,
    "nonBillableMinutes": 60,
    "totalMinutes":       240,
    "entryCount":         4
  }
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Task not found | `ErrorCode.TASK_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

## 8. Events to Publish

None in this wave. Time-tracking changes are not broadcast via NATS.

---

## 9. Events to Subscribe To

None in this wave.

---

## 10. Service-to-Service Calls

```typescript
// Instantiate once per request, passing the trace ID
const identityClient = createServiceClient(
  process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  { traceId: req.headers['x-trace-id'] as string }
)

// Verify membership
const { data: member } = await identityClient.get(
  `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
)
if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
```

| Service | Why | Endpoint |
|---------|-----|----------|
| identity-service | Verify workspace membership + role | `GET /api/v1/workspaces/:id/members/:userId` |

> **Note:** The task lookup (`getTaskWithWorkspace`) is done via a direct SQL query
> against the `tasks`, `lists`, and `spaces` tables — NOT via an HTTP call to task-service.
> This avoids cross-service HTTP overhead on every time-entry read and is consistent
> with the pattern established in comment-service (WO-010 Section 10).

---

## 11. Caching Rules

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Task time summary | Tier 3 (5min) | `time-summary:${taskId}` | On entry create, update, or delete for that task |
| Workspace member check | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | Never — let expire |

```typescript
// Cache invalidation pattern — call after every write that affects a task's entries:
await tier3Del(`time-summary:${taskId}`)

// Cache read pattern for time-summary:
const cacheKey = `time-summary:${taskId}`
const cached = await tier3Get<TimeSummary>(cacheKey)
if (cached !== null) return cached

const summary = await timeEntriesRepository.getTimeSummary(taskId)
await tier3Set(cacheKey, summary, 300)  // TTL: 300 seconds
return summary
```

> If `CacheKeys.timeSummary(taskId)` does not exist in the SDK's `CacheKeys` namespace,
> use the literal key string `time-summary:${taskId}` directly.

---

## 12. Mandatory Tests

### 12.1 Unit Tests — `tests/unit/time-entries.service.test.ts`

Mock the repository layer. Test the service in isolation.

```
□ createTimeEntry: inserts entry with correct userId from req.auth.userId
□ createTimeEntry: throws TASK_NOT_FOUND when task does not exist
□ createTimeEntry: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ createTimeEntry: throws VALIDATION_INVALID_INPUT when endedAt <= startedAt
□ createTimeEntry: throws VALIDATION_INVALID_INPUT when minutes < 1
□ createTimeEntry: invalidates time-summary cache after successful insert
□ createTimeEntry: does NOT invalidate cache when DB insert throws
□ listTimeEntries: throws VALIDATION_INVALID_INPUT when neither taskId nor userId provided
□ listTimeEntries: non-admin is scoped to their own entries (effectiveUserId = req.auth.userId)
□ listTimeEntries: admin can list entries for any userId in workspace
□ listTimeEntries: non-admin requesting another user's entries → AUTH_FORBIDDEN
□ updateTimeEntry: throws TIME_ENTRY_NOT_FOUND when entry does not exist
□ updateTimeEntry: author can update their own entry
□ updateTimeEntry: workspace admin can update another user's entry
□ updateTimeEntry: non-owner non-admin → AUTH_FORBIDDEN
□ updateTimeEntry: throws VALIDATION_INVALID_INPUT when merged dates have endedAt <= startedAt
□ updateTimeEntry: invalidates time-summary cache after successful update
□ deleteTimeEntry: throws TIME_ENTRY_NOT_FOUND when entry does not exist
□ deleteTimeEntry: author can delete their own entry
□ deleteTimeEntry: workspace admin can delete another user's entry
□ deleteTimeEntry: non-owner non-admin → AUTH_FORBIDDEN
□ deleteTimeEntry: invalidates time-summary cache after successful delete
□ getTimeSummary: returns cached value on cache hit (repository not called)
□ getTimeSummary: fetches from DB on cache miss and caches result
□ getTimeSummary: throws TASK_NOT_FOUND when task does not exist
```

### 12.2 Integration Tests — `tests/integration/time-entries.handler.test.ts`

```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async ()  => { await db.query('ROLLBACK') })
```

```
□ POST /api/v1/time-entries → 201, body matches TimeEntry shape
□ POST /api/v1/time-entries without auth → 401 AUTH_MISSING_TOKEN
□ POST /api/v1/time-entries with missing taskId → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/time-entries with non-existent taskId → 404 TASK_NOT_FOUND
□ POST /api/v1/time-entries with endedAt <= startedAt → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/time-entries with minutes = 0 → 422 VALIDATION_INVALID_INPUT
□ GET /api/v1/time-entries?taskId=... → 200 paginated, only entries for that task
□ GET /api/v1/time-entries?taskId=...&userId=... by non-admin for own entries → 200
□ GET /api/v1/time-entries?taskId=...&userId=<other> by non-admin → 403 AUTH_FORBIDDEN
□ GET /api/v1/time-entries with no taskId or userId → 422 VALIDATION_INVALID_INPUT
□ PATCH /api/v1/time-entries/:id → 200 with updated minutes
□ PATCH /api/v1/time-entries/:id by non-owner non-admin → 403 AUTH_FORBIDDEN
□ PATCH /api/v1/time-entries/:id by workspace admin for another's entry → 200
□ PATCH /api/v1/time-entries/:id not found → 404 TIME_ENTRY_NOT_FOUND
□ DELETE /api/v1/time-entries/:id → 204, entry removed
□ DELETE /api/v1/time-entries/:id by non-owner non-admin → 403 AUTH_FORBIDDEN
□ DELETE /api/v1/time-entries/:id not found → 404 TIME_ENTRY_NOT_FOUND
□ GET /api/v1/tasks/:taskId/time-summary → 200 with billableMinutes, nonBillableMinutes, totalMinutes, entryCount
□ GET /api/v1/tasks/:taskId/time-summary → correct counts after creating 2 billable + 1 non-billable entry
□ GET /api/v1/tasks/:taskId/time-summary not found → 404 TASK_NOT_FOUND
□ GET /api/v1/tasks/:taskId/time-summary → second call returns cached result
□ POST /api/v1/time-entries creates entry → subsequent GET /time-summary returns updated totals (cache invalidated)
□ GET /health → 200 with { postgres: "ok", redis: "ok" }
```

---

## 13. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ Coverage ≥ 80% lines
□ GET /health returns 200 with postgres/redis both "ok"
□ All mandatory test scenarios from Section 12 implemented
□ No console.log anywhere in src/ — use logger from @clickup/sdk
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No manual/custom validation — only validate(Schema, data) from SDK
□ No SQL in handler or service files — only in time-entries.repository.ts
□ time-summary cache invalidated on every create/update/delete (no stale summaries)
□ Non-admin users are always scoped to their own entries in list query
□ Hard-delete (not soft-delete) for time_entries — no deleted_at column exists
□ Task workspace lookup uses direct SQL JOIN — not an HTTP call to task-service
□ No NATS subscriptions or publications in this wave
□ .env file is NOT committed (only .env.example is committed)
□ packages/contracts and packages/sdk are not modified
□ PR description: "Time Tracking Service — log, query, and summarize time entries per task with 5-min summary cache"
```

---

## 14. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or migrations (time_entries already exists in 001_initial.sql)
✗ Do NOT use console.log — use logger
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL in handler or service files — repository files only
✗ Do NOT write manual validation — use validate(Schema, data) from SDK
✗ Do NOT soft-delete time entries — time_entries has no deleted_at column; use hard-delete
✗ Do NOT allow non-admins to read or modify other users' entries
✗ Do NOT call task-service via HTTP for workspace lookup — query tasks/lists/spaces tables directly
✗ Do NOT publish NATS events in this wave
✗ Do NOT skip cache invalidation — every create/update/delete must call tier3Del for the task's summary key
✗ Do NOT commit the .env file
```

---

## 15. Allowed Additional Dependencies

No additional dependencies beyond what `_template` provides. All caching, HTTP
clients, auth, and logging are provided by `@clickup/sdk`.
