# Work Order — Automations Service
**Wave:** 3
**Session ID:** WO-015
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-005 (task-service), WO-012 (notification-service)
**Branch name:** `wave3/automations-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Automations Service is the event-driven rule engine for the workspace. Users
configure automations as Trigger → Conditions → Actions triplets: "when a task is
created in list X AND it has priority Urgent, set its assignee to user Y and send
a notification". The service subscribes to every domain event published on NATS,
evaluates each enabled automation against the incoming event, checks conditions,
and executes the configured actions. Every execution is recorded in `automation_runs`
for audit and debugging. This service enables "no-code workflows" without coupling
task-service, comment-service, or any other service to each other.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → automations-service (:3010)
      → PostgreSQL (tables: automations, automation_runs [new migration])
      → identity-service (:3001) HTTP: verify workspace membership
      ↘ NATS publishes: (none — automations-service is a pure consumer)
      ← NATS subscribes (durable consumers):
          task.created
          task.updated
          task.status_changed
          task.assigned
          task.completed
          comment.created
          workspace.member_added
          workspace.member_removed

  Automation execution → task-service (:3002) HTTP: set_status, set_assignee, create_task
  Automation execution → notification-service (:3007) HTTP: send_notification
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/automations-service
cd services/automations-service

# In package.json change:
# "name": "@clickup/automations-service"

cp .env.example .env
# Edit: SERVICE_NAME=automations-service
# Edit: PORT=3010
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
# Edit: TASK_SERVICE_URL=http://localhost:3002
# Edit: NOTIFICATION_SERVICE_URL=http://localhost:3007
```

---

## 4. Files to Create

```
services/automations-service/
├── src/
│   ├── index.ts                              [copy _template, SERVICE_NAME=automations-service]
│   │                                         [wire up all NATS subscriptions in startup]
│   ├── routes.ts                             [register all HTTP routes]
│   ├── automations/
│   │   ├── automations.handler.ts            [HTTP handlers — no SQL, no business logic]
│   │   ├── automations.service.ts            [CRUD logic, auth checks]
│   │   └── automations.repository.ts         [all DB queries]
│   └── engine/
│       ├── engine.ts                         [subscribe(), evaluate(), execute() orchestration]
│       ├── evaluator.ts                      [condition evaluation logic]
│       └── executor.ts                       [action execution — HTTP calls to other services]
├── tests/
│   ├── unit/
│   │   ├── automations.service.test.ts       [mock repository, test CRUD logic]
│   │   ├── evaluator.test.ts                 [test condition matching in isolation]
│   │   └── executor.test.ts                  [mock HTTP clients, test action dispatch]
│   └── integration/
│       └── automations.handler.test.ts       [real DB, test HTTP layer]
├── package.json                              [name: @clickup/automations-service]
├── tsconfig.json                             [extend ../../tsconfig.base.json]
├── .env.example
└── .env                                      [NOT committed]
```

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Entity types
  Automation,
  AutomationCondition,
  AutomationAction,
  // Enums
  AutomationTriggerType,
  AutomationActionType,
  // Schemas
  CreateAutomationSchema,
  UpdateAutomationSchema,
  // Error codes
  ErrorCode,
  // Event subjects + payload types
  TASK_EVENTS,
  COMMENT_EVENTS,
  WORKSPACE_EVENTS,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  CommentCreatedEvent,
  WorkspaceMemberAddedEvent,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,
  asyncHandler,
  validate,
  AppError,
  subscribe,
  logger,
  createServiceClient,
} from '@clickup/sdk'
```

---

## 6. Database Tables

The `automations` table already exists in `001_initial.sql`. The `automation_runs`
table does NOT exist — you must create a migration for it.

### New migration required

Create `infra/migrations/004_automation_runs.sql` (check for filename collision
with existing migrations — use the next available number):

```sql
-- Migration: automation_runs table for execution history
CREATE TABLE automation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger_event   TEXT NOT NULL,              -- e.g. 'task.created'
  trigger_payload JSONB NOT NULL,             -- full event payload that triggered this run
  conditions_met  BOOLEAN NOT NULL,           -- true = conditions passed; false = skipped
  actions_taken   JSONB NOT NULL DEFAULT '[]', -- array of { type, config, success, error? }
  error           TEXT,                       -- NULL on success; error message on failure
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_automation_runs_automation
  ON automation_runs (automation_id, started_at DESC);

CREATE INDEX idx_automation_runs_workspace
  ON automation_runs (workspace_id, started_at DESC);
```

### Existing tables

| Table | Access | Notes |
|-------|--------|-------|
| `automations` | READ + WRITE | Core entity; always filter by workspace_id |
| `automation_runs` | READ + WRITE | Execution history — created via new migration |
| `workspace_members` | READ ONLY | Verify requesting user is in workspace |
| `users` | READ ONLY | Validate assignee IDs in action configs |

### Schema reference for automations table (do not recreate — for column names only)

```sql
-- automations
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name            TEXT NOT NULL
trigger_type    automation_trigger_type NOT NULL
trigger_config  JSONB NOT NULL DEFAULT '{}'
conditions      JSONB NOT NULL DEFAULT '[]'
actions         JSONB NOT NULL DEFAULT '[]'
is_enabled      BOOLEAN NOT NULL DEFAULT TRUE
run_count       INTEGER NOT NULL DEFAULT 0
created_by      UUID NOT NULL REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Automation shape reference

```typescript
// trigger_config examples:
// task_created:       { listId?: string }          — filter to specific list
// task_status_changed: { fromStatus?: string, toStatus?: string }
// task_assigned:      { assigneeId?: string }
// task_due_date_reached: {}                         — trigger is event-based

// condition examples (stored in JSONB array):
// [{ field: 'priority', operator: 'equals', value: 'urgent' }]
// [{ field: 'listId',   operator: 'equals', value: '<uuid>' }]
// [{ field: 'assigneeId', operator: 'is_empty', value: null }]

// action examples (stored in JSONB array):
// [{ type: 'set_status',     config: { status: 'in_progress' } }]
// [{ type: 'set_assignee',   config: { userId: '<uuid>' } }]
// [{ type: 'add_tag',        config: { tag: 'urgent' } }]
// [{ type: 'create_task',    config: { title: 'Follow-up', listId: '<uuid>' } }]
// [{ type: 'send_notification', config: { userId: '<uuid>', message: 'Task created' } }]
```

---

## 7. API Endpoints

All routes registered in `routes.ts`. All handlers use `asyncHandler()`. All body
parsing uses `validate(Schema, req.body)`.

---

### 7.1 Create Automation

```
POST /api/v1/automations
Auth: requireAuth
Body: CreateAutomationSchema {
  workspaceId: string,
  name: string,
  triggerType: AutomationTriggerType,
  triggerConfig: Record<string, unknown>,
  conditions: AutomationCondition[],
  actions: AutomationAction[]
}
```

**Handler steps (in automations.service.ts):**

1. Call `validate(CreateAutomationSchema, req.body)`.
2. Verify user is a member of `input.workspaceId` via identity-service (Section 10).
3. Validate that each action `type` is a valid `AutomationActionType` enum value:
   ```typescript
   const validActionTypes = ['set_status', 'set_assignee', 'add_tag', 'create_task', 'send_notification']
   for (const action of input.actions) {
     if (!validActionTypes.includes(action.type)) {
       throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, `Unknown action type: ${action.type}`)
     }
   }
   ```
4. Insert via repository:
   ```sql
   INSERT INTO automations (workspace_id, name, trigger_type, trigger_config, conditions, actions, is_enabled, created_by)
   VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
   RETURNING *
   ```
5. Return `HTTP 201` with `{ data: automation }`.

**Success** `HTTP 201`:
```json
{ "data": { /* Automation */ } }
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| Invalid action type | `ErrorCode.VALIDATION_INVALID_INPUT` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.2 List Automations

```
GET /api/v1/workspaces/:workspaceId/automations
Auth: requireAuth
Query params: none (returns all automations for workspace)
```

**Handler steps:**

1. Verify workspace membership.
2. Fetch all automations for workspace:
   ```sql
   SELECT *
   FROM automations
   WHERE workspace_id = $1
   ORDER BY created_at DESC
   ```
3. Return `HTTP 200` with `{ data: Automation[] }`.

---

### 7.3 Get Automation

```
GET /api/v1/automations/:automationId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the automation:
   ```sql
   SELECT * FROM automations WHERE id = $1
   ```
2. If not found: `throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)`.
3. Verify user is a member of `automation.workspaceId`.
4. Return `HTTP 200` with `{ data: automation }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Not found | `ErrorCode.AUTOMATION_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.4 Update Automation

```
PATCH /api/v1/automations/:automationId
Auth: requireAuth
Body: UpdateAutomationSchema { name?, triggerType?, triggerConfig?, conditions?, actions? }
```

**Handler steps:**

1. Call `validate(UpdateAutomationSchema, req.body)`.
2. Fetch the automation. Throw `AUTOMATION_NOT_FOUND` if not found.
3. Verify workspace membership.
4. Update via repository:
   ```sql
   UPDATE automations
   SET name           = COALESCE($2, name),
       trigger_type   = COALESCE($3, trigger_type),
       trigger_config = COALESCE($4, trigger_config),
       conditions     = COALESCE($5, conditions),
       actions        = COALESCE($6, actions),
       updated_at     = NOW()
   WHERE id = $1
   RETURNING *
   ```
5. Return `HTTP 200` with `{ data: updatedAutomation }`.

---

### 7.5 Delete Automation

```
DELETE /api/v1/automations/:automationId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the automation. Throw `AUTOMATION_NOT_FOUND` if not found.
2. Verify workspace membership. Only workspace owner or admin may delete:
   ```typescript
   const { data: member } = await identityClient.get(
     `/api/v1/workspaces/${automation.workspaceId}/members/${req.auth.userId}`
   )
   if (!member || !['owner', 'admin'].includes(member.role)) {
     throw new AppError(ErrorCode.AUTH_FORBIDDEN)
   }
   ```
3. Hard-delete (automations have no soft-delete column in schema):
   ```sql
   DELETE FROM automations WHERE id = $1
   ```
4. Return `HTTP 204` with no body.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Not found | `ErrorCode.AUTOMATION_NOT_FOUND` |
| User not owner/admin | `ErrorCode.AUTH_FORBIDDEN` |

---

### 7.6 Enable Automation

```
POST /api/v1/automations/:automationId/enable
Auth: requireAuth
```

```sql
UPDATE automations
SET is_enabled = TRUE, updated_at = NOW()
WHERE id = $1
RETURNING *
```

Return `HTTP 200` with `{ data: automation }`.

---

### 7.7 Disable Automation

```
POST /api/v1/automations/:automationId/disable
Auth: requireAuth
```

```sql
UPDATE automations
SET is_enabled = FALSE, updated_at = NOW()
WHERE id = $1
RETURNING *
```

Return `HTTP 200` with `{ data: automation }`.

---

### 7.8 Get Automation Runs

```
GET /api/v1/automations/:automationId/runs
Auth: requireAuth
Query params: limit (default 50, max 200), offset (default 0)
```

**Handler steps:**

1. Fetch the automation. Verify workspace membership.
2. Fetch runs:
   ```sql
   SELECT *
   FROM automation_runs
   WHERE automation_id = $1
   ORDER BY started_at DESC
   LIMIT $2 OFFSET $3
   ```
3. Return `HTTP 200`:
   ```json
   {
     "data": [/* AutomationRun[] */],
     "total": 42,
     "limit": 50,
     "offset": 0
   }
   ```

**AutomationRun response shape:**

```typescript
{
  id:             string   // UUID
  automationId:   string
  workspaceId:    string
  triggerEvent:   string   // e.g. 'task.created'
  triggerPayload: Record<string, unknown>
  conditionsMet:  boolean
  actionsTaken:   Array<{ type: string; config: Record<string, unknown>; success: boolean; error?: string }>
  error:          string | null
  startedAt:      string   // ISO 8601
  completedAt:    string | null
}
```

---

## 8. Events to Publish

This service does not publish any NATS events. It is a pure consumer.

---

## 9. NATS Subscriptions — Automation Engine

The automation engine subscribes to all supported trigger event types in
`src/index.ts` after the HTTP server starts and DB pool is ready.

Each subscription uses a durable consumer name so the service resumes from its
last position after a restart (no events are lost during downtime).

```typescript
// src/index.ts — inside the startup async function, after app.listen(...)

import { runAutomations } from './engine/engine'

const TRIGGER_SUBJECTS = [
  TASK_EVENTS.CREATED,
  TASK_EVENTS.UPDATED,
  TASK_EVENTS.STATUS_CHANGED,
  TASK_EVENTS.ASSIGNED,
  TASK_EVENTS.COMPLETED,
  COMMENT_EVENTS.CREATED,
  WORKSPACE_EVENTS.MEMBER_ADDED,
  WORKSPACE_EVENTS.MEMBER_REMOVED,
]

for (const subject of TRIGGER_SUBJECTS) {
  await subscribe(
    subject,
    async (payload) => {
      try {
        await runAutomations(subject, payload)
      } catch (err) {
        logger.error({ err, subject }, 'Automation engine error — event processing failed')
        throw err  // rethrow so NATS can redeliver
      }
    },
    { durable: `automations-svc-${subject.replace(/\./g, '-')}` }
  )
  logger.info({ subject }, 'Subscribed to event for automation engine')
}
```

---

## 10. Automation Engine — Evaluate and Execute

### 10.1 `engine/engine.ts` — Top-level orchestration

```typescript
// engine/engine.ts

import { automationsRepository } from '../automations/automations.repository'
import { evaluateConditions } from './evaluator'
import { executeActions } from './executor'
import { logger } from '@clickup/sdk'

export async function runAutomations(
  triggerEvent: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Map NATS event subject to automation trigger_type enum value
  const triggerTypeMap: Record<string, string> = {
    'task.created':        'task_created',
    'task.updated':        'task_field_changed',
    'task.status_changed': 'task_status_changed',
    'task.assigned':       'task_assigned',
    'task.completed':      'task_status_changed', // completed is a status change
    'comment.created':     'comment_created',
  }
  const triggerType = triggerTypeMap[triggerEvent]
  if (!triggerType) return  // event not mapped to any trigger type — skip

  // Extract workspaceId from event payload to scope the query
  const workspaceId = payload['workspaceId'] as string
  if (!workspaceId) {
    logger.warn({ triggerEvent }, 'Event missing workspaceId — cannot run automations')
    return
  }

  // Fetch only enabled automations matching this trigger type + workspace
  const automations = await automationsRepository.findEnabledByTrigger(workspaceId, triggerType)

  for (const automation of automations) {
    const runId = crypto.randomUUID()
    const startedAt = new Date()
    let conditionsMet = false
    const actionsTaken: Array<{ type: string; config: Record<string, unknown>; success: boolean; error?: string }> = []
    let runError: string | null = null

    try {
      // Check if the trigger config matches this event
      const triggerMatches = matchesTriggerConfig(triggerEvent, automation.triggerConfig, payload)
      if (!triggerMatches) continue

      conditionsMet = evaluateConditions(automation.conditions, payload)

      if (conditionsMet) {
        // Execute each action in order; capture individual success/failure
        for (const action of automation.actions) {
          try {
            await executeActions(action, payload, workspaceId)
            actionsTaken.push({ type: action.type, config: action.config, success: true })
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            actionsTaken.push({ type: action.type, config: action.config, success: false, error: errMsg })
            logger.error({ err, automationId: automation.id, action: action.type }, 'Action execution failed')
            // Continue to next action — do not abort the entire run
          }
        }

        // Increment run_count on the automation
        await automationsRepository.incrementRunCount(automation.id)
      }
    } catch (err) {
      runError = err instanceof Error ? err.message : String(err)
      logger.error({ err, automationId: automation.id, triggerEvent }, 'Automation run failed')
    } finally {
      // Always record the run (even if conditions not met — for auditability)
      await automationsRepository.recordRun({
        id:             runId,
        automationId:   automation.id,
        workspaceId,
        triggerEvent,
        triggerPayload: payload,
        conditionsMet,
        actionsTaken,
        error:          runError,
        startedAt,
        completedAt:    new Date(),
      })
    }
  }
}

function matchesTriggerConfig(
  event: string,
  triggerConfig: Record<string, unknown>,
  payload: Record<string, unknown>
): boolean {
  // task.created: optional listId filter
  if (event === 'task.created' && triggerConfig['listId']) {
    return payload['listId'] === triggerConfig['listId']
  }
  // task.status_changed: optional fromStatus / toStatus filter
  if (event === 'task.status_changed') {
    if (triggerConfig['fromStatus'] && payload['oldStatus'] !== triggerConfig['fromStatus']) return false
    if (triggerConfig['toStatus']   && payload['newStatus'] !== triggerConfig['toStatus'])   return false
  }
  // All other events: no trigger_config filtering in this wave
  return true
}
```

### 10.2 `engine/evaluator.ts` — Condition evaluation

```typescript
// engine/evaluator.ts

import type { AutomationCondition } from '@clickup/contracts'

// Evaluates ALL conditions with AND semantics.
// Returns true only if every condition passes.
export function evaluateConditions(
  conditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true  // no conditions = always match

  return conditions.every(condition => evaluateOne(condition, payload))
}

function evaluateOne(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  const fieldValue = payload[condition.field]

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value
    case 'not_equals':
      return fieldValue !== condition.value
    case 'contains':
      return typeof fieldValue === 'string'
        && typeof condition.value === 'string'
        && fieldValue.includes(condition.value)
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return false  // unknown operator — fail safe (do not execute actions)
  }
}
```

### 10.3 `engine/executor.ts` — Action execution

```typescript
// engine/executor.ts

import { createServiceClient, logger } from '@clickup/sdk'
import type { AutomationAction } from '@clickup/contracts'

export async function executeActions(
  action: AutomationAction,
  payload: Record<string, unknown>,
  workspaceId: string
): Promise<void> {
  const taskId      = payload['taskId'] as string | undefined
  const taskClient  = createServiceClient(
    process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002',
    { traceId: `automation-${workspaceId}` }
  )
  const notifClient = createServiceClient(
    process.env['NOTIFICATION_SERVICE_URL'] ?? 'http://localhost:3007',
    { traceId: `automation-${workspaceId}` }
  )

  switch (action.type) {
    case 'set_status':
      if (!taskId) throw new Error('set_status action requires taskId in event payload')
      await taskClient.patch(`/api/v1/tasks/${taskId}`, {
        status: action.config['status'],
      })
      break

    case 'set_assignee':
      if (!taskId) throw new Error('set_assignee action requires taskId in event payload')
      await taskClient.patch(`/api/v1/tasks/${taskId}`, {
        assigneeId: action.config['userId'],
      })
      break

    case 'add_tag':
      if (!taskId) throw new Error('add_tag action requires taskId in event payload')
      await taskClient.post(`/api/v1/tasks/${taskId}/tags`, {
        tag: action.config['tag'],
      })
      break

    case 'create_task': {
      const listId = action.config['listId'] as string
      if (!listId) throw new Error('create_task action requires listId in action config')
      await taskClient.post('/api/v1/tasks', {
        listId,
        title:    action.config['title'] ?? 'Automated Task',
        priority: action.config['priority'] ?? 'none',
      })
      break
    }

    case 'send_notification': {
      const userId = action.config['userId'] as string
      if (!userId) throw new Error('send_notification action requires userId in action config')
      await notifClient.post('/api/v1/notifications/send', {
        userId,
        type:    'task_mentioned',
        payload: {
          taskId,
          message: action.config['message'] ?? 'An automation triggered a notification',
          workspaceId,
        },
      })
      break
    }

    default:
      logger.warn({ actionType: action.type }, 'Unknown action type — skipping')
  }
}
```

### 10.4 Repository queries for engine

Add these methods to `automations.repository.ts`:

```typescript
// Fetch enabled automations for a workspace and trigger type
async findEnabledByTrigger(workspaceId: string, triggerType: string): Promise<Automation[]> {
  const result = await db.query<AutomationRow>(`
    SELECT *
    FROM automations
    WHERE workspace_id = $1
      AND trigger_type = $2
      AND is_enabled   = TRUE
    ORDER BY created_at ASC
  `, [workspaceId, triggerType])
  return result.rows.map(rowToAutomation)
}

// Increment run_count atomically
async incrementRunCount(automationId: string): Promise<void> {
  await db.query(`
    UPDATE automations
    SET run_count  = run_count + 1,
        updated_at = NOW()
    WHERE id = $1
  `, [automationId])
}

// Record a run in automation_runs
async recordRun(run: {
  id: string
  automationId: string
  workspaceId: string
  triggerEvent: string
  triggerPayload: Record<string, unknown>
  conditionsMet: boolean
  actionsTaken: unknown[]
  error: string | null
  startedAt: Date
  completedAt: Date
}): Promise<void> {
  await db.query(`
    INSERT INTO automation_runs
      (id, automation_id, workspace_id, trigger_event, trigger_payload,
       conditions_met, actions_taken, error, started_at, completed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    run.id, run.automationId, run.workspaceId, run.triggerEvent,
    JSON.stringify(run.triggerPayload), run.conditionsMet,
    JSON.stringify(run.actionsTaken), run.error, run.startedAt, run.completedAt,
  ])
}
```

---

## 11. Service-to-Service Calls

| Service | Why | Endpoint Used |
|---------|-----|---------------|
| identity-service | Verify workspace membership | `GET /api/v1/workspaces/:id/members/:userId` |
| task-service | `set_status`, `set_assignee`, `add_tag`, `create_task` actions | `PATCH /api/v1/tasks/:id`, `POST /api/v1/tasks/:id/tags`, `POST /api/v1/tasks` |
| notification-service | `send_notification` action | `POST /api/v1/notifications/send` |

```typescript
// Instantiate per request, passing trace ID
const identityClient = createServiceClient(
  process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  { traceId: req.headers['x-trace-id'] as string }
)
const { data: member } = await identityClient.get(
  `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
)
if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
```

---

## 12. Caching Rules

Automations are low-frequency reads (users configure them infrequently). No caching
is required in this wave. All automation reads hit the database directly.

The one exception is workspace membership for the auth check, which uses the SDK's
standard pattern from identity-service:

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Workspace member check | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | Never — let expire |

---

## 13. Mandatory Tests

### 13.1 Unit Tests — `tests/unit/`

**`automations.service.test.ts`** — mock repository:

```
□ createAutomation: inserts automation with is_enabled=true
□ createAutomation: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ createAutomation: throws VALIDATION_INVALID_INPUT when action type is unknown
□ getAutomation: throws AUTOMATION_NOT_FOUND when not found
□ getAutomation: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ updateAutomation: updates only provided fields (partial update)
□ deleteAutomation: only owner or admin can delete (throws AUTH_FORBIDDEN for member)
□ enableAutomation: sets is_enabled=true
□ disableAutomation: sets is_enabled=false
```

**`evaluator.test.ts`** — pure function, no mocks needed:

```
□ evaluateConditions: returns true when conditions array is empty
□ evaluateConditions: returns true when all conditions pass (AND semantics)
□ evaluateConditions: returns false when any single condition fails
□ operator 'equals': matches exact value, fails on mismatch
□ operator 'not_equals': fails on match, passes on mismatch
□ operator 'contains': passes when string contains substring
□ operator 'is_empty': passes for null, undefined, empty string
□ operator 'is_not_empty': passes for non-null non-empty string
□ operator unknown: returns false (fail safe)
```

**`executor.test.ts`** — mock HTTP service clients:

```
□ set_status action: calls PATCH /api/v1/tasks/:taskId with correct body
□ set_status action: throws when taskId missing from payload
□ set_assignee action: calls PATCH /api/v1/tasks/:taskId with correct body
□ add_tag action: calls POST /api/v1/tasks/:taskId/tags with correct tag
□ create_task action: calls POST /api/v1/tasks with listId + title from config
□ create_task action: throws when listId missing from action config
□ send_notification action: calls POST /api/v1/notifications/send with userId + payload
□ send_notification action: throws when userId missing from action config
□ unknown action type: logs warning, does not throw
```

### 13.2 Integration Tests — `tests/integration/automations.handler.test.ts`

```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async ()  => { await db.query('ROLLBACK') })
```

```
□ POST /api/v1/automations → 201, body matches Automation shape
□ POST /api/v1/automations without auth → 401 AUTH_MISSING_TOKEN
□ POST /api/v1/automations missing required fields → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/automations with unknown action type → 422 VALIDATION_INVALID_INPUT
□ GET /api/v1/workspaces/:id/automations → 200, returns array of automations for workspace
□ GET /api/v1/workspaces/:id/automations in different workspace → 403 AUTH_WORKSPACE_ACCESS_DENIED
□ GET /api/v1/automations/:id → 200 with automation
□ GET /api/v1/automations/:id not found → 404 AUTOMATION_NOT_FOUND
□ GET /api/v1/automations/:id in another workspace → 403 AUTH_WORKSPACE_ACCESS_DENIED
□ PATCH /api/v1/automations/:id → 200 with updated fields
□ PATCH /api/v1/automations/:id not found → 404 AUTOMATION_NOT_FOUND
□ DELETE /api/v1/automations/:id by member (not admin) → 403 AUTH_FORBIDDEN
□ DELETE /api/v1/automations/:id by admin → 204
□ DELETE /api/v1/automations/:id not found → 404 AUTOMATION_NOT_FOUND
□ POST /api/v1/automations/:id/enable → 200 with is_enabled=true
□ POST /api/v1/automations/:id/disable → 200 with is_enabled=false
□ GET /api/v1/automations/:id/runs → 200 with array of runs
□ GET /health → 200 with { postgres: "ok", nats: "ok" }
```

---

## 14. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ Coverage ≥ 80% lines
□ GET /health returns 200 with postgres/nats both "ok"
□ All mandatory test scenarios from Section 13 implemented
□ No console.log anywhere in src/ — use logger from @clickup/sdk
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No manual/custom validation — only validate(Schema, data) from SDK
□ No SQL in handler, service, engine, evaluator, or executor files — only in automations.repository.ts
□ Events evaluated ONLY from NATS — automations-service does not poll the DB for events
□ Durable NATS consumers wired for all trigger event types in index.ts
□ automation_runs table migration created (filename does not collide with existing migrations)
□ Automation run recorded for every triggered evaluation (even if conditions not met)
□ Action failures do not abort the automation run (continue to next action)
□ .env file is NOT committed (only .env.example is committed)
□ packages/contracts and packages/sdk are not modified
□ PR description: "Automations Service — NATS-driven rule engine with trigger/condition/action execution"
```

---

## 15. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables other than automation_runs (via migration)
✗ Do NOT use console.log — use logger
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL in handler, service, or engine files — repository files only
✗ Do NOT write manual validation — use validate(Schema, data) from SDK
✗ Do NOT publish NATS events — automations-service is a pure consumer
✗ Do NOT implement due_date_approaching trigger in this wave (it requires a scheduled job — defer to Wave 4)
✗ Do NOT call other services from within NATS subscription handlers synchronously in a way that can block event processing — use createServiceClient which is async
✗ Do NOT swallow action execution errors silently — log + record in automation_runs.actions_taken
✗ Do NOT hard-delete automations without checking that the caller is owner/admin
✗ Do NOT commit the .env file
```

---

## 16. Allowed Additional Dependencies

No additional dependencies beyond what `_template` provides. The engine uses only
`@clickup/sdk` and `@clickup/contracts`. `createServiceClient` from the SDK handles
all HTTP calls to other services.
