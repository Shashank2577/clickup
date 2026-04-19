# Work Order — Comment Service
**Wave:** 2
**Session ID:** WO-010
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-005 (task-service)
**Branch name:** `wave2/comment-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Comment Service owns all user comments attached to tasks. It handles threaded
discussions (top-level comments with nested replies), inline comment resolution,
and emoji reactions. It is the single source of truth for comment state.

When a task is deleted the comment service must soft-delete every comment that
belonged to that task — it listens for `task.deleted` events from NATS to do
this automatically without any coupling to task-service's HTTP layer.

Every other service that cares about comment activity (e.g. notification-service,
activity-service) subscribes to the events this service publishes — it never calls
them directly.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → comment-service (:3003)
      → PostgreSQL (tables: comments, comment_reactions)
      → identity-service (:3001) HTTP: verify workspace membership
      ↘ NATS publishes:
          comment.created
          comment.updated
          comment.deleted
          comment.resolved
          comment.reaction_added
      ← NATS subscribes:
          task.deleted  →  soft-delete all comments for that task
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/comment-service
cd services/comment-service

# In package.json change:
# "name": "@clickup/comment-service"

cp .env.example .env
# Edit: SERVICE_NAME=comment-service
# Edit: PORT=3003
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
```

---

## 4. Files to Create

```
services/comment-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=comment-service, PORT=3003]
│   ├── routes.ts                       [register all comment routes]
│   └── comments/
│       ├── comments.handler.ts         [HTTP handlers — no SQL, no business logic]
│       ├── comments.service.ts         [business logic, auth checks, event publishing]
│       └── comments.repository.ts      [all DB queries — no business logic here]
├── tests/
│   ├── unit/
│   │   └── comments.service.test.ts    [mock repository, test logic in isolation]
│   └── integration/
│       └── comments.handler.test.ts    [real DB via transaction rollback, test HTTP layer]
├── package.json                        [name: @clickup/comment-service]
├── tsconfig.json                       [extend ../../tsconfig.base.json]
├── .env.example
└── .env                                [NOT committed]
```

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Entity types (return shapes)
  Comment,
  CommentReaction,
  // Schemas (for validate() — never write manual validation)
  CreateCommentSchema,
  UpdateCommentSchema,
  AddReactionSchema,
  // Error codes
  ErrorCode,
  // Event subjects + payload types
  COMMENT_EVENTS,
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentResolvedEvent,
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
} from '@clickup/sdk'
```

---

## 6. Database Tables

The tables below **already exist** in PostgreSQL. Do NOT generate migrations or
CREATE TABLE statements. Do NOT alter column names — use them exactly as shown.

| Table | Access | Notes |
|-------|--------|-------|
| `comments` | READ + WRITE | Core entity. Always filter `deleted_at IS NULL` in reads |
| `comment_reactions` | READ + WRITE | Composite PK prevents duplicate reactions |
| `users` | READ ONLY | JOIN for `id`, `name`, `avatar_url` on comment reads |
| `tasks` | READ ONLY | Verify task exists before creating a comment |

### Schema reference (do not recreate — for column names only)

```sql
-- comments
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id)
content     TEXT NOT NULL CHECK (length(content) >= 1)
parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE
is_resolved BOOLEAN NOT NULL DEFAULT FALSE
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at  TIMESTAMPTZ

-- comment_reactions
comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
emoji       TEXT NOT NULL CHECK (length(emoji) >= 1 AND length(emoji) <= 10)
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
PRIMARY KEY (comment_id, user_id, emoji)
```

### Standard comment list query (copy exactly — do not write your own)

Use this query in `comments.repository.ts` for the list endpoint. It fetches
root-level comments with aggregated reaction data:

```sql
SELECT
  c.*,
  u.id         AS user_id,
  u.name       AS user_name,
  u.avatar_url AS user_avatar,
  json_agg(
    DISTINCT jsonb_build_object(
      'commentId', cr.comment_id,
      'userId',    cr.user_id,
      'emoji',     cr.emoji
    )
  ) FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions
FROM comments c
JOIN  users u              ON u.id  = c.user_id
LEFT JOIN comment_reactions cr ON cr.comment_id = c.id
WHERE c.task_id   = $1
  AND c.parent_id IS NULL
  AND c.deleted_at IS NULL
GROUP BY c.id, u.id, u.name, u.avatar_url
ORDER BY c.created_at ASC
```

> **Note:** Replies (rows where `parent_id IS NOT NULL`) are fetched in a second
> query keyed by the root comment IDs returned above, then nested into the response
> in the service layer. Do not attempt to do this in a single query.

### Reply fetch query

```sql
SELECT
  c.*,
  u.id         AS user_id,
  u.name       AS user_name,
  u.avatar_url AS user_avatar,
  json_agg(
    DISTINCT jsonb_build_object(
      'commentId', cr.comment_id,
      'userId',    cr.user_id,
      'emoji',     cr.emoji
    )
  ) FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions
FROM comments c
JOIN  users u              ON u.id  = c.user_id
LEFT JOIN comment_reactions cr ON cr.comment_id = c.id
WHERE c.parent_id = ANY($1::uuid[])
  AND c.deleted_at IS NULL
GROUP BY c.id, u.id, u.name, u.avatar_url
ORDER BY c.created_at ASC
```

Pass `$1` as the array of root comment IDs. Nest results in service layer:

```typescript
// In comments.service.ts — nest replies under their parent
const rootMap = new Map(rootComments.map(c => [c.id, { ...c, replies: [] as Comment[] }]))
for (const reply of replies) {
  rootMap.get(reply.parentId)?.replies.push(reply)
}
return [...rootMap.values()]
```

---

## 7. API Endpoints

All routes are registered in `routes.ts`. All handlers call `asyncHandler()`
from the SDK. All body parsing uses `validate(Schema, req.body)` — no manual
validation anywhere.

---

### 7.1 Create Comment

```
POST /api/v1/tasks/:taskId/comments
Auth: requireAuth
Body: CreateCommentSchema  { content: string, parentId?: string (UUID) }
```

**Handler steps (in comments.service.ts):**

1. Call `validate(CreateCommentSchema, req.body)`.
2. Look up `workspaceId` for the task:
   ```typescript
   // query tasks table JOIN spaces to get workspaceId
   const task = await commentsRepository.getTaskWithWorkspace(taskId)
   if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)
   ```
3. Verify workspace membership via identity-service (see Section 10).
4. If `parentId` is provided, verify the parent comment exists, belongs to the
   same `taskId`, and is not itself a reply (no nesting beyond one level):
   ```typescript
   const parent = await commentsRepository.getComment(input.parentId)
   if (!parent || parent.taskId !== taskId) throw new AppError(ErrorCode.COMMENT_NOT_FOUND)
   if (parent.parentId !== null) throw new AppError(ErrorCode.COMMENT_CANNOT_NEST_REPLIES)
   ```
   > `ErrorCode.COMMENT_CANNOT_NEST_REPLIES` must exist in contracts. If it does
   > not, throw `ErrorCode.VALIDATION_INVALID_INPUT` with message
   > `"Replies cannot be nested beyond one level"`.
5. Insert the row via `commentsRepository.createComment(...)`.
6. **After** the insert (never inside a transaction): publish `COMMENT_EVENTS.CREATED`.
7. Return `HTTP 201` with `{ data: comment }`.

**Event payload:**

```typescript
await publish(COMMENT_EVENTS.CREATED, {
  commentId:   comment.id,
  taskId:      comment.taskId,
  workspaceId,
  content:     comment.content,
  parentId:    comment.parentId ?? null,
  createdBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies CommentCreatedEvent)
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Task not found | `ErrorCode.TASK_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| parentId not found / wrong task | `ErrorCode.COMMENT_NOT_FOUND` |
| parentId is itself a reply | `ErrorCode.COMMENT_CANNOT_NEST_REPLIES` (or `VALIDATION_INVALID_INPUT`) |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.2 List Comments

```
GET /api/v1/tasks/:taskId/comments
Auth: requireAuth
```

**Handler steps:**

1. Verify workspace membership (same pattern as 7.1 step 2–3).
2. Fetch root comments with reactions using the standard query (Section 6).
3. If any root comments exist, fetch all replies with the reply query (Section 6).
4. Nest replies under parents in service layer.
5. Return `HTTP 200` with `{ data: Comment[] }`.

**Response shape per comment:**

```typescript
{
  id:         string   // UUID
  taskId:     string
  parentId:   string | null
  content:    string
  isResolved: boolean
  createdAt:  string   // ISO 8601
  updatedAt:  string
  user: {
    id:        string
    name:      string
    avatarUrl: string | null
  }
  reactions: Array<{
    commentId: string
    userId:    string
    emoji:     string
  }>
  replies: Comment[]   // only present on root comments; empty array if none
}
```

---

### 7.3 Edit Comment

```
PATCH /api/v1/comments/:commentId
Auth: requireAuth
Body: UpdateCommentSchema  { content: string }
```

**Handler steps:**

1. Call `validate(UpdateCommentSchema, req.body)`.
2. Fetch the comment: `await commentsRepository.getComment(commentId)`.
3. If not found or `deleted_at IS NOT NULL`:
   ```typescript
   throw new AppError(ErrorCode.COMMENT_NOT_FOUND)
   ```
4. Ownership check — only the author can edit:
   ```typescript
   if (comment.userId !== req.auth.userId) {
     throw new AppError(ErrorCode.COMMENT_CANNOT_EDIT_OTHERS)
   }
   ```
5. Update `content` and `updated_at = NOW()` via repository.
6. Publish `COMMENT_EVENTS.UPDATED` after DB write.
7. Return `HTTP 200` with `{ data: updatedComment }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Comment not found / deleted | `ErrorCode.COMMENT_NOT_FOUND` |
| User is not the author | `ErrorCode.COMMENT_CANNOT_EDIT_OTHERS` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.4 Delete Comment (Soft Delete)

```
DELETE /api/v1/comments/:commentId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the comment.
2. If not found or already deleted: `throw new AppError(ErrorCode.COMMENT_NOT_FOUND)`.
3. Permission check — author OR workspace owner/admin may delete:
   ```typescript
   const isAuthor = comment.userId === req.auth.userId
   if (!isAuthor) {
     // Verify caller is workspace owner/admin via identity-service
     const { data: member } = await identityClient.get(
       `/api/v1/workspaces/${workspaceId}/members/${req.auth.userId}`
     )
     if (!member || !['owner', 'admin'].includes(member.role)) {
       throw new AppError(ErrorCode.AUTH_FORBIDDEN)
     }
   }
   ```
4. Set `deleted_at = NOW()` via repository (do not hard-delete).
5. Replies are **not** explicitly deleted — they are hidden because the parent is
   deleted and the list query filters `deleted_at IS NULL`.
6. Publish `COMMENT_EVENTS.DELETED` after DB write.
7. Return `HTTP 204` with no body.

**Event payload:**

```typescript
await publish(COMMENT_EVENTS.DELETED, {
  commentId:   comment.id,
  taskId:      comment.taskId,
  workspaceId,
  deletedBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies CommentDeletedEvent)
```

---

### 7.5 Resolve Comment

```
POST /api/v1/comments/:commentId/resolve
Auth: requireAuth
```

**Handler steps:**

1. Fetch the comment.
2. If not found or deleted: `throw new AppError(ErrorCode.COMMENT_NOT_FOUND)`.
3. If already resolved:
   ```typescript
   if (comment.isResolved) {
     throw new AppError(ErrorCode.COMMENT_ALREADY_RESOLVED)
   }
   ```
4. Set `is_resolved = TRUE` and `updated_at = NOW()` via repository.
5. Publish `COMMENT_EVENTS.RESOLVED` after DB write.
6. Return `HTTP 200` with `{ data: resolvedComment }`.

**Event payload:**

```typescript
await publish(COMMENT_EVENTS.RESOLVED, {
  commentId:   comment.id,
  taskId:      comment.taskId,
  workspaceId,
  resolvedBy:  req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies CommentResolvedEvent)
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Comment not found / deleted | `ErrorCode.COMMENT_NOT_FOUND` |
| Already resolved | `ErrorCode.COMMENT_ALREADY_RESOLVED` |

---

### 7.6 Add Reaction

```
POST /api/v1/comments/:commentId/reactions
Auth: requireAuth
Body: AddReactionSchema  { emoji: string }
```

**Handler steps:**

1. Call `validate(AddReactionSchema, req.body)`.
2. Fetch the comment to confirm it exists and is not deleted.
3. Upsert the reaction row using `ON CONFLICT DO NOTHING`:
   ```sql
   INSERT INTO comment_reactions (comment_id, user_id, emoji)
   VALUES ($1, $2, $3)
   ON CONFLICT (comment_id, user_id, emoji) DO NOTHING
   ```
4. Publish `COMMENT_EVENTS.REACTION_ADDED` after DB write.
5. Return `HTTP 201` with `{ data: { commentId, userId, emoji } }`.

**Note:** If the reaction already exists the insert is a no-op and `HTTP 201`
is still returned. This is intentional — idempotent.

---

### 7.7 Remove Reaction

```
DELETE /api/v1/comments/:commentId/reactions/:emoji
Auth: requireAuth
```

**Handler steps:**

1. Fetch the comment to confirm it exists and is not deleted.
2. Delete the specific reaction row owned by the caller:
   ```sql
   DELETE FROM comment_reactions
   WHERE comment_id = $1
     AND user_id    = $2
     AND emoji      = $3
   ```
3. Return `HTTP 204` with no body.
   - If the row did not exist, still return `HTTP 204` (idempotent delete).
   - Do NOT publish an event for reaction removal.

---

## 8. Events to Publish

All events must be published **after** the DB write completes, never inside a
database transaction.

| Trigger | NATS Subject (via constant) | Payload Type |
|---------|-----------------------------|--------------|
| Comment created | `COMMENT_EVENTS.CREATED` | `CommentCreatedEvent` |
| Comment edited | `COMMENT_EVENTS.UPDATED` | *(inline object — no dedicated type needed)* |
| Comment soft-deleted | `COMMENT_EVENTS.DELETED` | `CommentDeletedEvent` |
| Comment resolved | `COMMENT_EVENTS.RESOLVED` | `CommentResolvedEvent` |
| Reaction added | `COMMENT_EVENTS.REACTION_ADDED` | *(inline object)* |

For `COMMENT_EVENTS.UPDATED` publish:

```typescript
await publish(COMMENT_EVENTS.UPDATED, {
  commentId:  comment.id,
  taskId:     comment.taskId,
  workspaceId,
  content:    updatedComment.content,
  updatedBy:  req.auth.userId,
  occurredAt: new Date().toISOString(),
})
```

For `COMMENT_EVENTS.REACTION_ADDED` publish:

```typescript
await publish(COMMENT_EVENTS.REACTION_ADDED, {
  commentId:  comment.id,
  taskId:     comment.taskId,
  workspaceId,
  userId:     req.auth.userId,
  emoji:      input.emoji,
  occurredAt: new Date().toISOString(),
})
```

---

## 9. NATS Subscriptions

Subscriptions are set up in `src/index.ts` **after** the HTTP server starts
listening and the DB pool is ready. They are **not** in any handler file.

```typescript
// src/index.ts — inside the startup async function, after app.listen(...)

await subscribe(
  'task.deleted',
  async (payload) => {
    await db.query(
      `UPDATE comments
          SET deleted_at = NOW()
        WHERE task_id    = $1
          AND deleted_at IS NULL`,
      [payload.taskId]
    )
    logger.info({ taskId: payload.taskId }, 'Soft-deleted comments for deleted task')
  },
  { durable: 'comment-svc-task-deleted' }
)
```

Rules:
- Use `logger.info` / `logger.error` — never `console.log`.
- Wrap the handler body in `try/catch`; on error call `logger.error` and re-throw
  so NATS can redeliver (do not swallow errors silently).
- The `durable` option ensures the subscription survives service restarts.

---

## 10. Service-to-Service Calls

The comment service calls identity-service to verify that the requesting user is
a member of the workspace before any write operation (create, edit, delete,
resolve, react).

```typescript
// Instantiate once per request, passing the trace ID for distributed tracing
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

Extract `workspaceId` from the task row (JOIN `tasks → lists → spaces` or use
whichever join path already exists in the task-service's response or your own
repository query). The simplest approach is a single JOIN query in
`commentsRepository.getTaskWithWorkspace(taskId)`:

```sql
SELECT t.id AS task_id, s.workspace_id
FROM   tasks  t
JOIN   lists  l ON l.id = t.list_id
JOIN   spaces s ON s.id = l.space_id
WHERE  t.id = $1
  AND  t.deleted_at IS NULL
```

---

## 11. Mandatory Tests

### 11.1 Unit Tests — `tests/unit/comments.service.test.ts`

Mock the repository layer. Test the service in isolation.

```
□ createComment: inserts comment and returns it with user data
□ createComment: throws TASK_NOT_FOUND when task does not exist
□ createComment: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ createComment: throws COMMENT_NOT_FOUND when parentId provided but not found
□ createComment: throws when parentId belongs to a different task
□ createComment: throws when parentId is itself a reply (no 2nd-level nesting)
□ createComment: publishes COMMENT_EVENTS.CREATED after DB write
□ createComment: does NOT publish event when DB insert throws
□ editComment: throws COMMENT_NOT_FOUND when comment does not exist
□ editComment: throws COMMENT_NOT_FOUND when comment is soft-deleted
□ editComment: throws COMMENT_CANNOT_EDIT_OTHERS when caller is not author
□ editComment: updates content and updated_at, publishes COMMENT_EVENTS.UPDATED
□ deleteComment: author can delete own comment
□ deleteComment: workspace admin can delete comment authored by another user
□ deleteComment: non-author non-admin throws AUTH_FORBIDDEN
□ deleteComment: publishes COMMENT_EVENTS.DELETED after soft-delete
□ resolveComment: throws COMMENT_ALREADY_RESOLVED when already resolved
□ resolveComment: sets is_resolved=true and publishes COMMENT_EVENTS.RESOLVED
□ addReaction: inserts reaction with ON CONFLICT DO NOTHING (idempotent)
□ addReaction: publishes COMMENT_EVENTS.REACTION_ADDED
□ removeReaction: deletes row, returns 204 even if row did not exist
□ listComments: returns root comments with nested replies and reactions
```

### 11.2 Integration Tests — `tests/integration/comments.handler.test.ts`

Use a real PostgreSQL database. Wrap every test in a transaction that is rolled
back in `afterEach` to ensure isolation.

```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async ()  => { await db.query('ROLLBACK') })
```

```
□ POST /api/v1/tasks/:taskId/comments → 201, body matches Comment shape
□ POST /api/v1/tasks/:taskId/comments without auth → 401 AUTH_MISSING_TOKEN
□ POST /api/v1/tasks/:taskId/comments missing content → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/tasks/:taskId/comments with non-existent taskId → 404 TASK_NOT_FOUND
□ POST /api/v1/tasks/:taskId/comments with valid parentId → 201, reply nested correctly on GET
□ POST /api/v1/tasks/:taskId/comments with parentId that is a reply → 422 (no nesting)
□ GET /api/v1/tasks/:taskId/comments → 200, only root comments returned at top level
□ GET /api/v1/tasks/:taskId/comments → replies nested under parent in `replies` array
□ GET /api/v1/tasks/:taskId/comments → reactions aggregated correctly
□ GET /api/v1/tasks/:taskId/comments → soft-deleted comments excluded
□ PATCH /api/v1/comments/:commentId → 200, content updated
□ PATCH /api/v1/comments/:commentId by non-author → 403 COMMENT_CANNOT_EDIT_OTHERS
□ PATCH /api/v1/comments/:commentId not found → 404 COMMENT_NOT_FOUND
□ DELETE /api/v1/comments/:commentId → 204, comment excluded from subsequent GET
□ DELETE /api/v1/comments/:commentId by workspace admin → 204
□ DELETE /api/v1/comments/:commentId by non-author non-admin → 403 AUTH_FORBIDDEN
□ POST /api/v1/comments/:commentId/resolve → 200, is_resolved=true
□ POST /api/v1/comments/:commentId/resolve on already-resolved → 409 COMMENT_ALREADY_RESOLVED
□ POST /api/v1/comments/:commentId/reactions → 201, reaction appears in GET
□ POST /api/v1/comments/:commentId/reactions duplicate emoji → 201 (idempotent)
□ DELETE /api/v1/comments/:commentId/reactions/:emoji → 204, reaction removed in GET
□ DELETE /api/v1/comments/:commentId/reactions/:emoji (not present) → 204 (idempotent)
□ GET /health → 200 with { postgres: "ok", nats: "ok" }
```

---

## 12. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ Coverage ≥ 80% lines
□ GET /health returns 200 with postgres/nats both "ok"
□ All mandatory test scenarios from Section 11 implemented
□ No console.log anywhere in src/ — use logger from @clickup/sdk
□ No raw Error thrown — only AppError(ErrorCode.X)
□ No manual/custom validation — only validate(Schema, data) from SDK
□ No SQL in handler or service files — only in comments.repository.ts
□ Events published AFTER DB write, never inside a DB transaction
□ NATS subscription for task.deleted wired up in index.ts startup
□ .env file is NOT committed (only .env.example is committed)
□ packages/contracts and packages/sdk are not modified
□ PR description: "Comment Service — threaded task comments, reactions, and resolution"
```

---

## 13. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or migrations (tables already exist)
✗ Do NOT use console.log — use logger
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL in handler or service files — repository files only
✗ Do NOT write manual validation — use validate(Schema, data) from SDK
✗ Do NOT support nesting replies more than one level deep
✗ Do NOT hard-delete comments — always set deleted_at
✗ Do NOT publish events inside a DB transaction
✗ Do NOT call task-service via HTTP for workspace lookup — query tasks/lists/spaces tables directly
✗ Do NOT implement comment search — that is search-service's responsibility
✗ Do NOT implement push notifications — publish events and let notification-service handle it
✗ Do NOT commit the .env file
```
