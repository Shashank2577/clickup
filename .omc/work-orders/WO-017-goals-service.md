# Work Order — Goals Service
**Wave:** 3
**Session ID:** WO-017
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-005 (task-service)
**Branch name:** `wave3/goals-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Goals Service owns OKR-style goals and their measurable targets. A goal is a
named objective owned by a workspace member with a due date and a color. Each goal
has one or more targets that define how progress is measured: a number target tracks
a numeric value toward a threshold, a currency target tracks monetary progress, a
boolean target is a binary done/not-done flag, and a task target is completed when a
specific linked task reaches the "done" status. Goal progress is the average of all
target progress percentages. This service subscribes to `task.completed` NATS events
to automatically advance task-type targets when their linked task is completed — no
manual update needed. Goal progress is cached for five minutes and invalidated on
every target update.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → goals-service (:3012)
      → PostgreSQL (tables: goals, goal_targets)
      → identity-service (:3001) HTTP: verify workspace membership
      ← NATS subscribes:
          task.completed  → increment currentValue on linked task-type goal targets
      ↘ NATS publishes:
          goal.created          (on POST /goals)
          goal.progress_updated (when target currentValue changes)
          goal.completed        (when progressPercent reaches 100)
      → Redis: cache goal progress per goalId (Tier 3, 5-min TTL)
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/goals-service
cd services/goals-service

# In package.json change:
# "name": "@clickup/goals-service"

cp .env.example .env
# Edit: SERVICE_NAME=goals-service
# Edit: PORT=3012
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
```

---

## 4. Files to Create

```
services/goals-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=goals-service, PORT=3012]
│   │                                   [wire up NATS subscription in startup]
│   ├── routes.ts                       [register all routes]
│   └── goals/
│       ├── goals.handler.ts            [HTTP handlers — no SQL, no business logic]
│       ├── goals.service.ts            [business logic, progress calculation, cache, events]
│       └── goals.repository.ts         [all DB queries — no business logic here]
├── tests/
│   ├── unit/
│   │   └── goals.service.test.ts       [mock repository, test logic in isolation]
│   └── integration/
│       └── goals.handler.test.ts       [real DB via transaction rollback, test HTTP layer]
├── package.json                        [name: @clickup/goals-service]
├── tsconfig.json                       [extend ../../tsconfig.base.json]
├── .env.example
└── .env                                [NOT committed]
```

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Entity types
  Goal,
  GoalTarget,
  GoalTargetType,
  // Schemas (for validate() — never write manual validation)
  CreateGoalSchema,
  UpdateGoalSchema,
  CreateGoalTargetSchema,
  UpdateGoalTargetSchema,
  // Error codes
  ErrorCode,
  // Event subjects + payload types
  GOAL_EVENTS,
  GoalProgressUpdatedEvent,
  // Task event for subscription
  TASK_EVENTS,
  TaskCompletedEvent,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,
  asyncHandler,
  validate,
  AppError,
  publish,
  subscribe,
  logger,
  createServiceClient,
  tier3Get,
  tier3Set,
  tier3Del,
  CacheKeys,
} from '@clickup/sdk'
```

---

## 6. Database Tables

Both `goals` and `goal_targets` already exist in `001_initial.sql`. Do NOT
generate migrations or CREATE TABLE statements.

| Table | Access | Notes |
|-------|--------|-------|
| `goals` | READ + WRITE | Core entity. Always filter `deleted_at IS NULL` |
| `goal_targets` | READ + WRITE | Belongs to goal; no soft-delete column |
| `workspace_members` | READ ONLY | Verify user is in workspace |
| `tasks` | READ ONLY | Verify linked task exists for task-type targets |

### Schema reference (do not recreate — for column names only)

```sql
-- goals
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name          TEXT NOT NULL
description   TEXT
due_date      TIMESTAMPTZ
owner_id      UUID NOT NULL REFERENCES users(id)
color         TEXT NOT NULL DEFAULT '#6366f1'
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at    TIMESTAMPTZ

-- goal_targets
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE
name            TEXT NOT NULL
type            goal_target_type NOT NULL   -- 'number' | 'currency' | 'boolean' | 'task'
target_value    NUMERIC                     -- NULL for boolean targets
current_value   NUMERIC NOT NULL DEFAULT 0
task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL  -- for 'task' type targets only
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Standard goal fetch with targets (copy this — do not write your own)

```sql
-- Use for GET /goals/:goalId
SELECT
  g.*,
  json_agg(
    jsonb_build_object(
      'id',           gt.id,
      'goalId',       gt.goal_id,
      'name',         gt.name,
      'type',         gt.type,
      'targetValue',  gt.target_value,
      'currentValue', gt.current_value,
      'taskId',       gt.task_id,
      'createdAt',    gt.created_at,
      'updatedAt',    gt.updated_at
    ) ORDER BY gt.created_at ASC
  ) FILTER (WHERE gt.id IS NOT NULL) AS targets
FROM goals g
LEFT JOIN goal_targets gt ON gt.goal_id = g.id
WHERE g.id = $1
  AND g.deleted_at IS NULL
GROUP BY g.id
```

### Progress calculation — use this exact formula

```typescript
// In goals.service.ts — compute progressPercent from targets array
function computeGoalProgress(targets: GoalTarget[]): number {
  if (targets.length === 0) return 0

  const targetProgressValues = targets.map(t => computeTargetProgress(t))
  const sum = targetProgressValues.reduce((acc, val) => acc + val, 0)
  return Math.round(sum / targets.length)  // integer 0–100
}

function computeTargetProgress(target: GoalTarget): number {
  switch (target.type) {
    case 'boolean':
      // current_value = 0 (not done) or 1 (done)
      return target.currentValue >= 1 ? 100 : 0

    case 'task':
      // current_value = 0 (task open) or 1 (task completed)
      return target.currentValue >= 1 ? 100 : 0

    case 'number':
    case 'currency':
      if (!target.targetValue || target.targetValue <= 0) return 0
      const pct = (target.currentValue / target.targetValue) * 100
      return Math.min(100, Math.max(0, Math.round(pct)))  // clamp 0–100

    default:
      return 0
  }
}
```

---

## 7. API Endpoints

All routes registered in `routes.ts`. All handlers use `asyncHandler()`. All body
parsing uses `validate(Schema, req.body)` — no manual validation.

---

### 7.1 Create Goal

```
POST /api/v1/goals
Auth: requireAuth
Body: CreateGoalSchema {
  workspaceId:  string (UUID),
  name:         string,
  description?: string,
  dueDate?:     string (ISO 8601),
  color?:       string (hex, default '#6366f1')
}
```

**Handler steps (in goals.service.ts):**

1. Call `validate(CreateGoalSchema, req.body)`.
2. Verify workspace membership via identity-service (Section 10).
3. Insert the goal:
   ```sql
   INSERT INTO goals (workspace_id, name, description, due_date, owner_id, color)
   VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#6366f1'))
   RETURNING *
   ```
   Set `owner_id = req.auth.userId`.
4. Publish `GOAL_EVENTS.CREATED`:
   ```typescript
   await publish(GOAL_EVENTS.CREATED, {
     goalId:      goal.id,
     workspaceId: goal.workspaceId,
     name:        goal.name,
     createdBy:   req.auth.userId,
     occurredAt:  new Date().toISOString(),
   })
   ```
5. Return `HTTP 201` with `{ data: { ...goal, targets: [], progressPercent: 0 } }`.

**Success** `HTTP 201`:
```json
{
  "data": {
    "id":             "uuid",
    "workspaceId":    "uuid",
    "name":           "Reach $1M ARR",
    "description":    null,
    "dueDate":        "2026-12-31T00:00:00Z",
    "ownerId":        "uuid",
    "color":          "#6366f1",
    "createdAt":      "2026-04-19T10:00:00Z",
    "updatedAt":      "2026-04-19T10:00:00Z",
    "targets":        [],
    "progressPercent": 0
  }
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| Workspace not found | `ErrorCode.WORKSPACE_NOT_FOUND` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.2 Get Goal (Includes Progress %)

```
GET /api/v1/goals/:goalId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the goal with targets using the standard query (Section 6).
2. If not found or `deleted_at IS NOT NULL`: `throw new AppError(ErrorCode.GOAL_NOT_FOUND)`.
3. Verify workspace membership.
4. **Cache-aside for progress:**
   ```typescript
   const cacheKey = `goal-progress:${goalId}`
   const cachedProgress = await tier3Get<number>(cacheKey)
   const progressPercent = cachedProgress !== null
     ? cachedProgress
     : computeGoalProgress(goal.targets)

   if (cachedProgress === null) {
     await tier3Set(cacheKey, progressPercent, 300)  // 300s = 5 minutes
   }
   ```
5. Return `HTTP 200` with `{ data: { ...goal, progressPercent } }`.

**Response shape:**

```typescript
{
  id:             string
  workspaceId:    string
  name:           string
  description:    string | null
  dueDate:        string | null  // ISO 8601
  ownerId:        string
  color:          string
  createdAt:      string
  updatedAt:      string
  targets: Array<{
    id:           string
    goalId:       string
    name:         string
    type:         'number' | 'currency' | 'boolean' | 'task'
    targetValue:  number | null
    currentValue: number
    taskId:       string | null
    createdAt:    string
    updatedAt:    string
  }>
  progressPercent: number  // 0–100, integer
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Goal not found / deleted | `ErrorCode.GOAL_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.3 List Goals for Workspace

```
GET /api/v1/workspaces/:workspaceId/goals
Auth: requireAuth
```

**Handler steps:**

1. Verify workspace membership.
2. Fetch all goals for workspace with targets:
   ```sql
   SELECT
     g.*,
     json_agg(
       jsonb_build_object(
         'id',           gt.id,
         'goalId',       gt.goal_id,
         'name',         gt.name,
         'type',         gt.type,
         'targetValue',  gt.target_value,
         'currentValue', gt.current_value,
         'taskId',       gt.task_id,
         'createdAt',    gt.created_at,
         'updatedAt',    gt.updated_at
       ) ORDER BY gt.created_at ASC
     ) FILTER (WHERE gt.id IS NOT NULL) AS targets
   FROM goals g
   LEFT JOIN goal_targets gt ON gt.goal_id = g.id
   WHERE g.workspace_id = $1
     AND g.deleted_at IS NULL
   GROUP BY g.id
   ORDER BY g.created_at DESC
   ```
3. For each goal, compute `progressPercent = computeGoalProgress(goal.targets)`.
   Do NOT cache progress on list queries — only the individual GET endpoint uses cache.
4. Return `HTTP 200` with `{ data: Goal[] }`.

---

### 7.4 Update Goal

```
PATCH /api/v1/goals/:goalId
Auth: requireAuth
Body: UpdateGoalSchema { name?, description?, dueDate?, color? }
```

**Handler steps:**

1. Call `validate(UpdateGoalSchema, req.body)`.
2. Fetch the goal. Throw `GOAL_NOT_FOUND` if not found or deleted.
3. Verify workspace membership.
4. Update via repository:
   ```sql
   UPDATE goals
   SET name        = COALESCE($2, name),
       description = COALESCE($3, description),
       due_date    = COALESCE($4, due_date),
       color       = COALESCE($5, color),
       updated_at  = NOW()
   WHERE id = $1
     AND deleted_at IS NULL
   RETURNING *
   ```
5. Return `HTTP 200` with `{ data: updatedGoal }`.

> Note: goal metadata updates do NOT invalidate the progress cache — only target
> value changes affect progress. The updated_at trigger fires automatically.

---

### 7.5 Delete Goal (Soft Delete)

```
DELETE /api/v1/goals/:goalId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the goal. Throw `GOAL_NOT_FOUND` if not found or already deleted.
2. Verify workspace membership. Only the goal owner OR workspace admin/owner may delete:
   ```typescript
   const isOwner = goal.ownerId === req.auth.userId
   if (!isOwner) {
     const { data: member } = await identityClient.get(
       `/api/v1/workspaces/${goal.workspaceId}/members/${req.auth.userId}`
     )
     if (!member || !['owner', 'admin'].includes(member.role)) {
       throw new AppError(ErrorCode.AUTH_FORBIDDEN)
     }
   }
   ```
3. Soft-delete:
   ```sql
   UPDATE goals
   SET deleted_at = NOW()
   WHERE id = $1
     AND deleted_at IS NULL
   ```
4. Invalidate progress cache: `await tier3Del(`goal-progress:${goalId}`)`.
5. Return `HTTP 204` with no body.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Goal not found / deleted | `ErrorCode.GOAL_NOT_FOUND` |
| User is not goal owner and not admin | `ErrorCode.AUTH_FORBIDDEN` |

---

### 7.6 Add Target to Goal

```
POST /api/v1/goals/:goalId/targets
Auth: requireAuth
Body: CreateGoalTargetSchema {
  name:          string,
  type:          'number' | 'currency' | 'boolean' | 'task',
  targetValue?:  number,   -- required for 'number' and 'currency'; omit for 'boolean' and 'task'
  taskId?:       string,   -- UUID; required when type = 'task'
  currentValue?: number    -- optional initial value (default 0)
}
```

**Handler steps:**

1. Call `validate(CreateGoalTargetSchema, req.body)`.
2. Fetch the goal. Throw `GOAL_NOT_FOUND` if not found or deleted.
3. Verify workspace membership.
4. Type-specific validation:
   ```typescript
   if (['number', 'currency'].includes(input.type)) {
     if (input.targetValue === undefined || input.targetValue === null) {
       throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT,
         `targetValue is required for ${input.type} targets`)
     }
     if (input.targetValue <= 0) {
       throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT,
         'targetValue must be greater than 0')
     }
   }
   if (input.type === 'task') {
     if (!input.taskId) {
       throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT,
         'taskId is required for task targets')
     }
     // Verify the task exists and belongs to same workspace
     const task = await goalsRepository.getTaskWithWorkspace(input.taskId)
     if (!task || task.workspaceId !== goal.workspaceId) {
       throw new AppError(ErrorCode.TASK_NOT_FOUND)
     }
   }
   ```
5. Insert target:
   ```sql
   INSERT INTO goal_targets (goal_id, name, type, target_value, current_value, task_id)
   VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6)
   RETURNING *
   ```
6. Invalidate progress cache: `await tier3Del(`goal-progress:${goalId}`)`.
7. Return `HTTP 201` with `{ data: target }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Goal not found / deleted | `ErrorCode.GOAL_NOT_FOUND` |
| Missing targetValue for number/currency | `ErrorCode.VALIDATION_INVALID_INPUT` |
| Missing taskId for task type | `ErrorCode.VALIDATION_INVALID_INPUT` |
| taskId not found or wrong workspace | `ErrorCode.TASK_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.7 Update Target

```
PATCH /api/v1/goals/:goalId/targets/:targetId
Auth: requireAuth
Body: UpdateGoalTargetSchema {
  name?:         string,
  currentValue?: number,
  targetValue?:  number,
  taskId?:       string
}
```

**Handler steps:**

1. Call `validate(UpdateGoalTargetSchema, req.body)`.
2. Fetch goal and verify it exists, is not deleted, and user is in workspace.
3. Fetch the target:
   ```sql
   SELECT * FROM goal_targets WHERE id = $1 AND goal_id = $2
   ```
   If not found: `throw new AppError(ErrorCode.GOAL_TARGET_NOT_FOUND)`.
4. Record old `currentValue` for the event payload.
5. Update via repository:
   ```sql
   UPDATE goal_targets
   SET name          = COALESCE($3, name),
       current_value = COALESCE($4, current_value),
       target_value  = COALESCE($5, target_value),
       task_id       = COALESCE($6, task_id),
       updated_at    = NOW()
   WHERE id = $1
     AND goal_id = $2
   RETURNING *
   ```
6. Invalidate progress cache: `await tier3Del(`goal-progress:${goalId}`)`.
7. Re-fetch targets and compute new progress:
   ```typescript
   const allTargets = await goalsRepository.getTargetsForGoal(goalId)
   const newProgress = computeGoalProgress(allTargets)
   ```
8. Publish `GOAL_EVENTS.PROGRESS_UPDATED`:
   ```typescript
   await publish(GOAL_EVENTS.PROGRESS_UPDATED, {
     goalId,
     targetId: updatedTarget.id,
     workspaceId: goal.workspaceId,
     oldValue:  oldCurrentValue,
     newValue:  updatedTarget.currentValue,
     occurredAt: new Date().toISOString(),
   } satisfies GoalProgressUpdatedEvent)
   ```
9. If `newProgress >= 100`, also publish `GOAL_EVENTS.COMPLETED`:
   ```typescript
   if (newProgress >= 100) {
     await publish(GOAL_EVENTS.COMPLETED, {
       goalId,
       workspaceId: goal.workspaceId,
       occurredAt:  new Date().toISOString(),
     })
   }
   ```
10. Return `HTTP 200` with `{ data: updatedTarget }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Goal not found / deleted | `ErrorCode.GOAL_NOT_FOUND` |
| Target not found / not in goal | `ErrorCode.GOAL_TARGET_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

## 8. Events to Publish

All events must be published **after** the DB write completes, never inside a
database transaction.

| Trigger | NATS Subject (via constant) | Payload Type |
|---------|-----------------------------|--------------|
| Goal created | `GOAL_EVENTS.CREATED` | inline object `{ goalId, workspaceId, name, createdBy, occurredAt }` |
| Target `currentValue` changes | `GOAL_EVENTS.PROGRESS_UPDATED` | `GoalProgressUpdatedEvent` |
| Goal progress reaches 100% | `GOAL_EVENTS.COMPLETED` | inline object `{ goalId, workspaceId, occurredAt }` |

> `GOAL_EVENTS.CREATED` and `GOAL_EVENTS.COMPLETED` publish inline objects; no
> dedicated TypeScript type exists in contracts for these (the events.ts file only
> defines `GoalProgressUpdatedEvent`). Use `satisfies GoalProgressUpdatedEvent`
> only for the progress event.

For `GOAL_EVENTS.PROGRESS_UPDATED`:

```typescript
await publish(GOAL_EVENTS.PROGRESS_UPDATED, {
  goalId,
  targetId:    updatedTarget.id,
  workspaceId: goal.workspaceId,
  oldValue:    oldCurrentValue,        // numeric; was currentValue before update
  newValue:    updatedTarget.currentValue,
  occurredAt:  new Date().toISOString(),
} satisfies GoalProgressUpdatedEvent)
```

For `GOAL_EVENTS.COMPLETED`:

```typescript
await publish(GOAL_EVENTS.COMPLETED, {
  goalId,
  workspaceId: goal.workspaceId,
  occurredAt:  new Date().toISOString(),
})
```

---

## 9. NATS Subscriptions

Subscriptions are set up in `src/index.ts` **after** the HTTP server starts
listening and the DB pool is ready.

```typescript
// src/index.ts — inside the startup async function, after app.listen(...)

await subscribe(
  TASK_EVENTS.COMPLETED,
  async (payload: TaskCompletedEvent) => {
    try {
      // Find all task-type goal targets linked to this task
      const targets = await db.query<{ id: string; goal_id: string; current_value: number }>(`
        SELECT gt.id, gt.goal_id, gt.current_value
        FROM goal_targets gt
        WHERE gt.task_id = $1
          AND gt.type    = 'task'
          AND gt.current_value < 1
      `, [payload.taskId])

      for (const target of targets.rows) {
        // Mark task target as complete by setting current_value = 1
        await db.query(`
          UPDATE goal_targets
          SET current_value = 1,
              updated_at    = NOW()
          WHERE id = $1
        `, [target.id])

        // Invalidate goal progress cache
        await tier3Del(`goal-progress:${target.goal_id}`)

        // Publish progress event
        await publish(GOAL_EVENTS.PROGRESS_UPDATED, {
          goalId:      target.goal_id,
          targetId:    target.id,
          workspaceId: payload.workspaceId,
          oldValue:    target.current_value,
          newValue:    1,
          occurredAt:  new Date().toISOString(),
        } satisfies GoalProgressUpdatedEvent)

        // Check if the goal is now complete
        const allTargets = await db.query<{ current_value: number; target_value: number; type: string }>(`
          SELECT current_value, target_value, type FROM goal_targets WHERE goal_id = $1
        `, [target.goal_id])

        const progress = computeGoalProgress(allTargets.rows.map(r => ({
          type:         r.type as GoalTargetType,
          currentValue: Number(r.current_value),
          targetValue:  r.target_value ? Number(r.target_value) : null,
        } as GoalTarget)))

        if (progress >= 100) {
          await publish(GOAL_EVENTS.COMPLETED, {
            goalId:      target.goal_id,
            workspaceId: payload.workspaceId,
            occurredAt:  new Date().toISOString(),
          })
        }

        logger.info({ taskId: payload.taskId, targetId: target.id }, 'Task-type goal target completed')
      }
    } catch (err) {
      logger.error({ err, taskId: payload.taskId }, 'Failed to update task-type goal targets')
      throw err  // rethrow for NATS redelivery
    }
  },
  { durable: 'goals-svc-task-completed' }
)
```

Rules:
- Use `logger.info` / `logger.error` — never `console.log`.
- Wrap handler body in `try/catch`; re-throw on error so NATS can redeliver.
- The `durable` option ensures the subscription survives service restarts.
- Import `computeGoalProgress` from `goals.service.ts` (or extract to a shared utility file).

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

> **Note:** Task existence for task-type targets is verified via a direct SQL JOIN
> query against `tasks`, `lists`, `spaces` tables — NOT via an HTTP call to task-service.
> Pattern is consistent with comment-service (WO-010).

Repository query for task workspace lookup:

```typescript
// In goals.repository.ts
async getTaskWithWorkspace(taskId: string): Promise<{ workspaceId: string } | null> {
  const result = await db.query<{ workspace_id: string }>(`
    SELECT s.workspace_id
    FROM tasks  t
    JOIN lists  l ON l.id = t.list_id
    JOIN spaces s ON s.id = l.space_id
    WHERE t.id          = $1
      AND t.deleted_at IS NULL
  `, [taskId])
  if (!result.rows[0]) return null
  return { workspaceId: result.rows[0].workspace_id }
}
```

---

## 11. Caching Rules

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Goal progress % | Tier 3 (5min) | `goal-progress:${goalId}` | On target create, target update, goal delete |
| Workspace member check | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | Never — let expire |

```typescript
// Read pattern for GET /goals/:goalId
const cacheKey = `goal-progress:${goalId}`
const cachedProgress = await tier3Get<number>(cacheKey)
if (cachedProgress !== null) {
  return { ...goal, progressPercent: cachedProgress }
}
const progressPercent = computeGoalProgress(goal.targets)
await tier3Set(cacheKey, progressPercent, 300)  // 300s TTL
return { ...goal, progressPercent }

// Invalidate pattern — call after any target create/update/delete:
await tier3Del(`goal-progress:${goalId}`)
```

> Do NOT cache progress on the workspace-level goals list (GET /workspaces/:id/goals).
> Only the individual GET /goals/:goalId endpoint benefits from caching. List queries
> always compute progress fresh.

---

## 12. Mandatory Tests

### 12.1 Unit Tests — `tests/unit/goals.service.test.ts`

Mock the repository layer. Test the service in isolation.

```
□ computeGoalProgress: returns 0 when targets array is empty
□ computeGoalProgress: returns average of all target progress values
□ computeGoalProgress: correctly handles mix of number, boolean, and task targets
□ computeTargetProgress (number): returns 0 when targetValue is 0 or null
□ computeTargetProgress (number): returns 50 when currentValue is half of targetValue
□ computeTargetProgress (number): clamps to 100 when currentValue exceeds targetValue
□ computeTargetProgress (boolean): returns 0 when currentValue = 0
□ computeTargetProgress (boolean): returns 100 when currentValue >= 1
□ computeTargetProgress (task): returns 0 when currentValue = 0, 100 when >= 1
□ createGoal: inserts goal with owner_id = req.auth.userId
□ createGoal: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ createGoal: publishes GOAL_EVENTS.CREATED after insert
□ getGoal: throws GOAL_NOT_FOUND when not found or soft-deleted
□ getGoal: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ getGoal: returns cached progressPercent on cache hit
□ getGoal: computes and caches progressPercent on cache miss
□ deleteGoal: goal owner can delete; non-owner non-admin → AUTH_FORBIDDEN
□ deleteGoal: workspace admin can delete goal they don't own
□ deleteGoal: invalidates goal-progress cache
□ addTarget: throws GOAL_NOT_FOUND when goal not found/deleted
□ addTarget: throws VALIDATION_INVALID_INPUT for number type without targetValue
□ addTarget: throws VALIDATION_INVALID_INPUT for task type without taskId
□ addTarget: throws TASK_NOT_FOUND when taskId not found or wrong workspace
□ addTarget: invalidates goal-progress cache after insert
□ updateTarget: throws GOAL_TARGET_NOT_FOUND when target not found
□ updateTarget: throws GOAL_TARGET_NOT_FOUND when target belongs to different goal
□ updateTarget: publishes GOAL_EVENTS.PROGRESS_UPDATED after update
□ updateTarget: publishes GOAL_EVENTS.COMPLETED when newProgress >= 100
□ updateTarget: does NOT publish GOAL_EVENTS.COMPLETED when progress < 100
□ updateTarget: invalidates goal-progress cache after update
□ NATS task.completed handler: sets current_value=1 on linked task-type targets
□ NATS task.completed handler: does not update targets that are already complete (current_value >= 1)
□ NATS task.completed handler: publishes GOAL_EVENTS.PROGRESS_UPDATED for each updated target
□ NATS task.completed handler: publishes GOAL_EVENTS.COMPLETED when progress reaches 100
```

### 12.2 Integration Tests — `tests/integration/goals.handler.test.ts`

```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async ()  => { await db.query('ROLLBACK') })
```

```
□ POST /api/v1/goals → 201 with Goal shape, targets=[], progressPercent=0
□ POST /api/v1/goals without auth → 401 AUTH_MISSING_TOKEN
□ POST /api/v1/goals missing name → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/goals with non-existent workspaceId → 403 AUTH_WORKSPACE_ACCESS_DENIED
□ GET /api/v1/goals/:goalId → 200 with goal + targets + progressPercent
□ GET /api/v1/goals/:goalId not found → 404 GOAL_NOT_FOUND
□ GET /api/v1/goals/:goalId soft-deleted → 404 GOAL_NOT_FOUND
□ GET /api/v1/goals/:goalId in another workspace → 403 AUTH_WORKSPACE_ACCESS_DENIED
□ GET /api/v1/workspaces/:workspaceId/goals → 200 array of goals with progressPercent
□ PATCH /api/v1/goals/:goalId → 200 with updated name/description
□ PATCH /api/v1/goals/:goalId not found → 404 GOAL_NOT_FOUND
□ DELETE /api/v1/goals/:goalId by owner → 204
□ DELETE /api/v1/goals/:goalId by non-owner non-admin → 403 AUTH_FORBIDDEN
□ DELETE /api/v1/goals/:goalId by workspace admin → 204
□ DELETE /api/v1/goals/:goalId not found → 404 GOAL_NOT_FOUND
□ POST /api/v1/goals/:goalId/targets → 201 with target shape
□ POST /api/v1/goals/:goalId/targets with type=number and no targetValue → 422
□ POST /api/v1/goals/:goalId/targets with type=task and no taskId → 422
□ PATCH /api/v1/goals/:goalId/targets/:targetId → 200 with updated currentValue
□ PATCH /api/v1/goals/:goalId/targets/:targetId not found → 404 GOAL_TARGET_NOT_FOUND
□ PATCH /api/v1/goals/:goalId/targets/:targetId with wrong goalId → 404 GOAL_TARGET_NOT_FOUND
□ GET /api/v1/goals/:goalId after adding number target: progressPercent reflects currentValue/targetValue
□ GET /api/v1/goals/:goalId after adding boolean target set to 0: progressPercent = 0
□ PATCH target currentValue to targetValue → GET /goals/:goalId returns progressPercent=100
□ GET /api/v1/goals/:goalId second call returns cached progressPercent (no extra DB query for progress)
□ PATCH target → subsequent GET /goals/:goalId returns fresh (not stale cached) progress
□ GET /health → 200 with { postgres: "ok", nats: "ok", redis: "ok" }
```

---

## 13. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ Coverage ≥ 80% lines
□ GET /health returns 200 with postgres/nats/redis all "ok"
□ All mandatory test scenarios from Section 12 implemented
□ No console.log anywhere in src/ — use logger from @clickup/sdk
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No manual/custom validation — only validate(Schema, data) from SDK
□ No SQL in handler or service files — only in goals.repository.ts
□ computeGoalProgress and computeTargetProgress are in goals.service.ts (not repository)
□ Events published AFTER DB write, never inside a DB transaction
□ NATS subscription for task.completed wired up in index.ts startup
□ goal-progress cache invalidated on every target create/update and goal delete
□ Workspace-level goals list (GET /workspaces/:id/goals) does NOT use progress cache
□ task-type target auto-update via NATS does NOT call task-service HTTP — reads from NATS payload
□ .env file is NOT committed (only .env.example is committed)
□ packages/contracts and packages/sdk are not modified
□ PR description: "Goals Service — OKR-style goals with typed targets, progress calculation, and task.completed auto-update"
```

---

## 14. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or migrations (goals and goal_targets exist in 001_initial.sql)
✗ Do NOT use console.log — use logger
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL in handler or service files — repository files only
✗ Do NOT write manual validation — use validate(Schema, data) from SDK
✗ Do NOT hard-delete goals — always set deleted_at
✗ Do NOT publish events inside a DB transaction
✗ Do NOT cache the workspace-level goals list — only cache individual goal progress
✗ Do NOT allow setting progressPercent via HTTP — it is always derived from targets, never stored
✗ Do NOT call task-service via HTTP for task existence checks — query DB directly
✗ Do NOT update task-type targets via HTTP when task.completed fires — use the NATS subscription only
✗ Do NOT skip cache invalidation after target updates — stale progress data will fail tests
✗ Do NOT commit the .env file
```

---

## 15. Allowed Additional Dependencies

No additional dependencies beyond what `_template` provides. All caching, HTTP
clients, auth, NATS, and logging are provided by `@clickup/sdk`.
