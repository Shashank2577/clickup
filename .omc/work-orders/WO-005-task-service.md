# Work Order — Task Service
**Wave:** 2
**Session ID:** WO-005
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-004 (api-gateway)
**Branch name:** `wave2/task-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Task Service owns the core entity of the entire product: tasks.
It handles creating, reading, updating, moving, and deleting tasks and their
full hierarchy (tasks → subtasks). It also manages checklists, tags, task
relations, watchers, and custom field values on tasks. Every other service
that needs task data calls this service — it is the single source of truth
for task state.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → task-service (:3002)
      → PostgreSQL (tables: tasks, checklists, checklist_items,
                            task_tags, task_watchers, task_relations,
                            task_custom_fields)
      ↘ NATS publishes:
          task.created
          task.updated
          task.deleted
          task.moved
          task.assigned
          task.completed
          task.status_changed
      ← NATS subscribes: (none in this wave)
      → identity-service (HTTP): verify workspace membership
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/task-service
cd services/task-service

# In package.json change:
# "name": "@clickup/task-service"

cp .env.example .env
# Edit: SERVICE_NAME=task-service
# Edit: PORT=3002
```

---

## 4. Files to Create

```
services/task-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=task-service]
│   ├── routes.ts                       [register all task routes]
│   ├── tasks/
│   │   ├── tasks.handler.ts            [HTTP handlers]
│   │   ├── tasks.service.ts            [business logic, validation, events]
│   │   ├── tasks.repository.ts         [DB queries]
│   │   └── tasks.queries.ts            [SQL string constants]
│   ├── checklists/
│   │   ├── checklists.handler.ts
│   │   ├── checklists.service.ts
│   │   └── checklists.repository.ts
│   └── loaders/
│       └── task.loader.ts              [DataLoader for batch user fetches]
├── tests/
│   ├── unit/
│   │   ├── tasks.service.test.ts
│   │   └── checklists.service.test.ts
│   ├── integration/
│   │   ├── tasks.handler.test.ts
│   │   └── checklists.handler.test.ts
│   └── contract/
│       └── task.contract.test.ts
├── package.json
├── tsconfig.json
├── .env
└── .env.example
```

---

## 5. Imports

```typescript
// From @clickup/contracts
import {
  // Entity types (return shapes)
  Task, TaskWithRelations, TaskSummary, Checklist, ChecklistItem,
  PaginatedResponse,
  // Input types
  CreateTaskInput, UpdateTaskInput, MoveTaskInput, TaskListQuery,
  CreateChecklistInput, CreateChecklistItemInput, UpdateChecklistItemInput,
  // Schemas (for validate())
  CreateTaskSchema, UpdateTaskSchema, MoveTaskSchema, TaskListQuerySchema,
  CreateChecklistSchema, CreateChecklistItemSchema, UpdateChecklistItemSchema,
  AddTaskTagSchema, AddTaskRelationSchema,
  // Errors
  ErrorCode,
  // Events
  TASK_EVENTS,
  TaskCreatedEvent, TaskUpdatedEvent, TaskDeletedEvent,
  TaskMovedEvent, TaskAssignedEvent, TaskCompletedEvent, TaskStatusChangedEvent,
  // Enums
  TaskPriority, TaskRelationType,
} from '@clickup/contracts'

// From @clickup/sdk
import {
  requireAuth, AppError, asyncHandler, validate,
  tier2Get, tier2Set, tier2Del, CacheKeys,
  publish, createDataLoader, logger, createServiceClient,
} from '@clickup/sdk'
```

---

## 6. Database Tables

| Table | Access | Notes |
|-------|--------|-------|
| `tasks` | READ + WRITE | Core entity. Always filter `deleted_at IS NULL` |
| `checklists` | READ + WRITE | Belongs to task |
| `checklist_items` | READ + WRITE | Belongs to checklist |
| `task_tags` | READ + WRITE | Simple join table |
| `task_watchers` | READ + WRITE | Simple join table |
| `task_relations` | READ + WRITE | Typed relations between tasks |
| `task_custom_fields` | READ + WRITE | JSONB values per field |
| `users` | READ ONLY | For assignee name/avatar joins |
| `lists` | READ ONLY | Verify list exists + get space_id |
| `spaces` | READ ONLY | Get workspace_id from list |
| `workspace_members` | READ ONLY | Verify user is in workspace |
| `custom_fields` | READ ONLY | Validate field type before saving value |

### Materialized Path Rules

```typescript
// Compute path for a new ROOT task in a list:
const path = `/${listId}/${newTaskId}/`

// Compute path for a SUBTASK:
const path = `${parentTask.path}${newTaskId}/`

// Fetch ALL descendants of a task (any depth):
const query = `
  SELECT * FROM tasks
  WHERE path LIKE $1
    AND deleted_at IS NULL
  ORDER BY path, position
`
const params = [`${task.path}%`]
// NOTE: this matches the task itself AND all descendants
// To exclude the task itself: WHERE path LIKE $1 AND id != $2

// Update paths when moving a task (update task + all descendants atomically):
await db.query(`
  UPDATE tasks
  SET path = $1 || substring(path FROM length($2) + 1)
  WHERE path LIKE $2 || '%'
    AND deleted_at IS NULL
`, [newBasePath, oldPath])
```

### Standard Task Fetch Query (copy this — do not write your own)

```sql
-- Use this for single task + relations fetches
SELECT
  t.*,
  u.id     AS assignee_user_id,
  u.name   AS assignee_name,
  u.avatar_url AS assignee_avatar,
  COUNT(DISTINCT s.id) AS subtask_count,
  COUNT(DISTINCT c.id) AS comment_count
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL
LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
WHERE t.id = $1
  AND t.deleted_at IS NULL
GROUP BY t.id, u.id, u.name, u.avatar_url
```

```sql
-- Use this for list view (tasks in a list, no deep subtasks)
SELECT
  t.*,
  u.id         AS assignee_user_id,
  u.name       AS assignee_name,
  u.avatar_url AS assignee_avatar,
  COUNT(DISTINCT s.id) AS subtask_count,
  COUNT(DISTINCT c.id) AS comment_count
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL
LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
WHERE t.list_id = $1
  AND t.parent_id IS NULL        -- root tasks only
  AND t.deleted_at IS NULL
GROUP BY t.id, u.id, u.name, u.avatar_url
ORDER BY t.position ASC
LIMIT $2 OFFSET $3
```

---

## 7. API Endpoints

### 7.1 Create Task
```
POST /api/v1/tasks
Auth: requireAuth
Body: CreateTaskSchema
```

**Success** `HTTP 201`:
```json
{ "data": { /* TaskWithRelations */ } }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| listId not found | `ErrorCode.LIST_NOT_FOUND` |
| parentId not in same list | `ErrorCode.TASK_INVALID_PARENT` |
| parentId depth > 5 | `ErrorCode.TASK_MAX_DEPTH_EXCEEDED` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

**Path computation:**
```typescript
const newId = randomUUID()
const path = parentTask
  ? `${parentTask.path}${newId}/`
  : `/${input.listId}/${newId}/`
```

---

### 7.2 Get Task
```
GET /api/v1/tasks/:taskId
Auth: requireAuth
Body: none
```

**Success** `HTTP 200`:
```json
{ "data": { /* TaskWithRelations including checklist, relations, tags, watchers */ } }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| Not found or deleted | `ErrorCode.TASK_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.3 List Tasks
```
GET /api/v1/lists/:listId/tasks
Auth: requireAuth
Query params: TaskListQuerySchema (status, assigneeId, priority, dueBefore, dueAfter, tags, page, pageSize)
```

**Success** `HTTP 200`:
```json
{
  "data": [ /* TaskSummary[] */ ],
  "total": 42,
  "page": 1,
  "pageSize": 50,
  "hasMore": false
}
```

---

### 7.4 Update Task
```
PATCH /api/v1/tasks/:taskId
Auth: requireAuth
Body: UpdateTaskSchema
```

**Success** `HTTP 200`:
```json
{ "data": { /* Task */ } }
```

**Events to publish:** `task.updated` always. Additionally:
- If `assigneeId` changed → also publish `task.assigned`
- If `status` changed to a "done" status → also publish `task.completed` + `task.status_changed`
- If `status` changed (not done) → publish `task.status_changed`

---

### 7.5 Move Task
```
POST /api/v1/tasks/:taskId/move
Auth: requireAuth
Body: MoveTaskSchema { listId, parentId?, position? }
```

**Circular move check (mandatory):**
```typescript
// Before moving: verify target parentId is not a descendant of taskId
if (input.parentId) {
  const target = await repository.getTask(input.parentId)
  if (target.path.startsWith(task.path)) {
    throw new AppError(ErrorCode.TASK_CANNOT_MOVE_TO_OWN_DESCENDANT)
  }
}
```

**Path update (must be atomic):**
```typescript
// Update task + ALL descendants in one query (see Section 6)
await db.query(
  `UPDATE tasks SET path = $1 || substring(path FROM length($2) + 1)
   WHERE path LIKE $2 || '%' AND deleted_at IS NULL`,
  [newBasePath, oldPath]
)
```

**Event:** `task.moved`

---

### 7.6 Delete Task (Soft Delete)
```
DELETE /api/v1/tasks/:taskId
Auth: requireAuth
```

**Cascade soft delete:** When deleting a task, also soft-delete all descendants:
```sql
UPDATE tasks
SET deleted_at = NOW()
WHERE path LIKE $1 || '%'
  AND deleted_at IS NULL
```

**Success** `HTTP 204`: no body

**Event:** `task.deleted`

---

### 7.7 Add/Remove Tag
```
POST   /api/v1/tasks/:taskId/tags    Body: AddTaskTagSchema
DELETE /api/v1/tasks/:taskId/tags/:tag
```
No event published for tags.

---

### 7.8 Add/Remove Watcher
```
POST   /api/v1/tasks/:taskId/watchers
DELETE /api/v1/tasks/:taskId/watchers/:userId
```
No event published for watchers.

---

### 7.9 Add Task Relation
```
POST /api/v1/tasks/:taskId/relations
Auth: requireAuth
Body: AddTaskRelationSchema { relatedTaskId, type }
```

**Validation:**
```typescript
if (taskId === input.relatedTaskId) {
  throw new AppError(ErrorCode.TASK_SELF_RELATION)
}
// Check duplicate
const exists = await repository.getRelation(taskId, input.relatedTaskId, input.type)
if (exists) throw new AppError(ErrorCode.TASK_RELATION_ALREADY_EXISTS)
```

---

### 7.10 Checklist Endpoints
```
POST   /api/v1/tasks/:taskId/checklists              Body: CreateChecklistSchema
DELETE /api/v1/tasks/:taskId/checklists/:checklistId

POST   /api/v1/checklists/:checklistId/items         Body: CreateChecklistItemSchema
PATCH  /api/v1/checklists/:checklistId/items/:itemId Body: UpdateChecklistItemSchema
DELETE /api/v1/checklists/:checklistId/items/:itemId
```

---

## 8. Events to Publish

```typescript
// task.created
await publish(TASK_EVENTS.CREATED, {
  taskId: task.id,
  listId: task.listId,
  spaceId,           // fetched from list → space
  workspaceId,       // fetched from space
  title: task.title,
  createdBy: req.auth.userId,
  assigneeId: task.assigneeId,
  parentId: task.parentId,
  occurredAt: new Date().toISOString(),
} satisfies TaskCreatedEvent)

// task.updated
await publish(TASK_EVENTS.UPDATED, {
  taskId: task.id,
  listId: task.listId,
  workspaceId,
  changes: changedFields,  // only fields that actually changed
  updatedBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
} satisfies TaskUpdatedEvent)

// task.assigned — only when assigneeId changes
await publish(TASK_EVENTS.ASSIGNED, {
  taskId: task.id,
  listId: task.listId,
  workspaceId,
  assigneeId: newAssigneeId,
  previousAssigneeId: oldAssigneeId,
  assignedBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
} satisfies TaskAssignedEvent)
```

Full event table:

| Trigger | Subject | Payload Type |
|---------|---------|--------------|
| Create task | `TASK_EVENTS.CREATED` | `TaskCreatedEvent` |
| Update task | `TASK_EVENTS.UPDATED` | `TaskUpdatedEvent` |
| Delete task | `TASK_EVENTS.DELETED` | `TaskDeletedEvent` |
| Move task | `TASK_EVENTS.MOVED` | `TaskMovedEvent` |
| Assign task | `TASK_EVENTS.ASSIGNED` | `TaskAssignedEvent` |
| Status → done | `TASK_EVENTS.COMPLETED` | `TaskCompletedEvent` |
| Status changed | `TASK_EVENTS.STATUS_CHANGED` | `TaskStatusChangedEvent` |

---

## 9. Events to Subscribe To

None in this wave.

---

## 10. Service-to-Service Calls

```typescript
// Call identity-service to verify workspace membership
const identityClient = createServiceClient(
  process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  { traceId: req.headers['x-trace-id'] as string }
)

// Verify user is a member of the workspace before any task operation
const { data } = await identityClient.get(
  `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
)
if (!data) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
```

---

## 11. Caching Rules

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Workspace members (for auth check) | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | Never (let it expire) |
| Subtask count | Tier 3 (5min) | `CacheKeys.taskSubtreeCount(taskId)` | On task created/deleted in subtree |
| List task count | Tier 3 (5min) | `CacheKeys.listTaskCount(listId)` | On task created/deleted in list |

---

## 12. Mandatory Tests

### 12.1 Unit Tests (mock repository)

```
□ createTask: creates with correct path for root task
□ createTask: creates with correct path for subtask (appends to parent path)
□ createTask: throws TASK_MAX_DEPTH_EXCEEDED when nesting > 5
□ createTask: throws TASK_INVALID_PARENT when parentId is in different list
□ moveTask: throws TASK_CANNOT_MOVE_TO_OWN_DESCENDANT when moving to child
□ moveTask: computes correct new path for task and descendants
□ updateTask: publishes task.assigned event when assigneeId changes
□ updateTask: publishes task.completed when status changes to done status
□ updateTask: publishes task.status_changed when status changes to non-done
□ deleteTask: soft-deletes task and all descendants (path LIKE pattern)
□ addRelation: throws TASK_SELF_RELATION when taskId === relatedTaskId
□ addRelation: throws TASK_RELATION_ALREADY_EXISTS on duplicate
```

### 12.2 Integration Tests (real DB, real Postgres)

```typescript
// Setup: use transaction rollback between tests
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async () => { await db.query('ROLLBACK') })
```

```
□ POST /tasks → 201, response matches TaskWithRelations shape
□ POST /tasks with missing title → 422 VALIDATION_INVALID_INPUT
□ POST /tasks with non-existent listId → 404 LIST_NOT_FOUND
□ POST /tasks without auth header → 401 AUTH_MISSING_TOKEN
□ GET /tasks/:id → 200 with task, assignee, subtask_count, comment_count
□ GET /tasks/:id with invalid UUID → 422 VALIDATION_INVALID_UUID
□ GET /tasks/:id not found → 404 TASK_NOT_FOUND
□ GET /tasks/:id in another workspace → 404 (not 403)
□ GET /lists/:id/tasks → 200 paginated, only root tasks (no subtasks)
□ PATCH /tasks/:id → 200 updated fields reflected
□ PATCH /tasks/:id status change → publishes task.status_changed event
□ POST /tasks/:id/move to own descendant → 422 TASK_CANNOT_MOVE_TO_OWN_DESCENDANT
□ POST /tasks/:id/move → all descendant paths updated correctly
□ DELETE /tasks/:id → 204, task soft-deleted, subtasks soft-deleted
□ POST /tasks/:id/tags → tag appears in subsequent GET
□ DELETE /tasks/:id/tags/:tag → tag removed in subsequent GET
□ Materialized path: fetch 3-level deep subtree in single query
□ Concurrent: two clients move different tasks simultaneously → no corruption
```

### 12.3 Contract Tests

```typescript
// Every response must match the schema from @clickup/contracts
import { Task, TaskWithRelations } from '@clickup/contracts'
// Use a JSON schema validator to verify responses match entity types
```

---

## 13. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all 30+ tests pass
□ Coverage ≥ 80% lines
□ GET /health returns 200 with postgres/redis/nats all "ok"
□ All mandatory test scenarios implemented
□ No console.log in source code
□ No raw Error thrown — only AppError
□ No custom validation — only validate() from SDK
□ No SQL outside repository files
□ No LLM calls — task-service never calls AI APIs
□ Path LIKE used for tree queries (no recursive CTEs)
□ Events published AFTER DB write, never inside transaction
□ .env not committed
□ PR description: "Task Service — manages task CRUD, hierarchy, and lifecycle events"
```

---

## 14. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or migrations
✗ Do NOT use recursive CTEs — use path LIKE $1 || '%'
✗ Do NOT implement search — that is search-service's responsibility
✗ Do NOT implement notifications — publish events and let notification-service handle it
✗ Do NOT call the AI service — task-service has no AI features
✗ Do NOT implement views (Kanban, Calendar) — that is a frontend concern
✗ Do NOT add soft-delete logic anywhere except DELETE endpoints
✗ Do NOT commit the .env file
```

---

## 15. Allowed Additional Dependencies

```json
{
  "uuid": "^9.0.0"
}
```
Only if `randomUUID` from Node crypto is insufficient for your use case (it isn't — prefer Node crypto).
