# Work Order — Notification Service
**Wave:** 2
**Session ID:** WO-012
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-005 (task-service)
**Branch name:** `wave2/notification-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Notification Service is the inbox for every user in the system. It listens
to domain events published by other services (task assigned, comment created,
etc.) and translates them into persistent in-app notifications stored in
PostgreSQL. It also exposes a REST API so the frontend can fetch, mark as read,
and delete notifications. This service is purely reactive — it never initiates
business logic, never modifies tasks or comments, and never calls other services.

---

## 2. Context: How This Service Fits

```
task-service ──► NATS: task.assigned   ──► notification-service (:3007)
comment-service ► NATS: comment.created ──►       │
                                                   ├─► PostgreSQL (notifications table)
                                                   │
Client                                             │
  → API Gateway (:3000)                            │
    → notification-service (:3007) ◄───────────────┘
        GET  /api/v1/notifications
        PATCH /api/v1/notifications/:id/read
        POST  /api/v1/notifications/read-all
        DELETE /api/v1/notifications/:id
        GET  /api/v1/notifications/unread-count

notification-service publishes:
    NOTIFICATION_EVENTS (future — publish after each INSERT for real-time push)

notification-service subscribes:
    TASK_EVENTS.ASSIGNED      (durable: notif-svc-task-assigned)
    COMMENT_EVENTS.CREATED    (durable: notif-svc-comment-created)
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/notification-service
cd services/notification-service

# In package.json change:
# "name": "@clickup/notification-service"

cp .env.example .env
# Edit: SERVICE_NAME=notification-service
# Edit: PORT=3007
```

---

## 4. Files to Create

```
services/notification-service/
├── src/
│   ├── index.ts                               [copy _template; SERVICE_NAME=notification-service, PORT=3007]
│   ├── routes.ts                              [register notification routes]
│   └── notifications/
│       ├── notifications.handler.ts           [HTTP endpoint handlers]
│       ├── notifications.repository.ts        [all DB queries — no SQL elsewhere]
│       └── notifications.subscriber.ts        [NATS event handlers, exports startNotificationSubscribers]
├── package.json
├── tsconfig.json
└── .env.example
```

No `service.ts` layer is needed — the subscriber and handler files call the
repository directly. The notification domain has no complex business logic that
warrants a separate service layer.

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Event subjects
  TASK_EVENTS,
  COMMENT_EVENTS,
  NOTIFICATION_EVENTS,
  // Event payload interfaces
  TaskAssignedEvent,
  CommentCreatedEvent,
  // Entity type (returned in API responses)
  Notification,
  // Enum of notification types
  NotificationType,
  // Error codes
  ErrorCode,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,
  asyncHandler,
  AppError,
  publish,
  subscribe,
  logger,
} from '@clickup/sdk'
```

No other third-party dependencies are needed beyond what the monorepo template
already provides.

---

## 6. Database Tables

The `notifications` table **already exists**. Do NOT create it or run migrations.
Connect with the shared `db` instance provided by the template's `index.ts`.

```
Table: notifications
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `user_id` | `UUID` | FK → `users(id) ON DELETE CASCADE` |
| `type` | `notification_type` | enum — see values below |
| `payload` | `JSONB` | event-specific data |
| `is_read` | `BOOLEAN` | default `FALSE` |
| `created_at` | `TIMESTAMPTZ` | default `NOW()` |

`notification_type` enum values (already defined in the DB — do NOT redefine):
- `task_assigned`
- `task_commented`
- `task_mentioned`
- `task_due_soon`
- `task_overdue`

Index already in place: `idx_notifications_user ON notifications (user_id, is_read, created_at DESC)`

This service reads from and writes to `notifications` only. Do NOT read or write any other table.

---

## 7. API Endpoints

All endpoints require authentication via `requireAuth`. All SQL lives in
`notifications.repository.ts`. Handlers must not contain SQL or raw business logic beyond
calling the repository and returning the result.

### 7.1 List Notifications

```
GET /api/v1/notifications
Auth: requireAuth
Query params:
  unreadOnly  boolean  (optional) — if "true", filter is_read = FALSE
  limit       number   (optional, default 50, max 100)
  before      string   (optional) — ISO timestamp; return notifications created before this time
```

**Logic:**
```typescript
const userId = req.auth.userId
const unreadOnly = req.query['unreadOnly'] === 'true'
const limit = Math.min(Number(req.query['limit'] ?? 50), 100)
const before = req.query['before']
  ? new Date(req.query['before'] as string)
  : new Date()   // default: now

const notifications = await repository.listNotifications({ userId, unreadOnly, limit, before })
```

**Success** `HTTP 200`:
```json
{ "data": [ /* Notification[] ordered by created_at DESC */ ] }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| No auth header | `ErrorCode.AUTH_MISSING_TOKEN` |

---

### 7.2 Mark One Notification as Read

```
PATCH /api/v1/notifications/:notificationId/read
Auth: requireAuth
Body: none
```

**Logic:**
```typescript
const updated = await repository.markOneRead({
  notificationId: req.params['notificationId'],
  userId: req.auth.userId,   // ownership enforced in SQL via AND user_id = $2
})
if (!updated) throw new AppError(ErrorCode.NOTIFICATION_NOT_FOUND)
```

**Success** `HTTP 200`:
```json
{ "data": { "ok": true } }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| Not found or does not belong to user | `ErrorCode.NOTIFICATION_NOT_FOUND` |

---

### 7.3 Mark All Notifications as Read

```
POST /api/v1/notifications/read-all
Auth: requireAuth
Body: none
```

**Logic:** Update all unread notifications for `req.auth.userId` in one query.
Always succeeds (even if there are no unread notifications to update).

**Success** `HTTP 204`: no body

---

### 7.4 Delete a Notification

```
DELETE /api/v1/notifications/:notificationId
Auth: requireAuth
Body: none
```

**Logic:**
```typescript
const deleted = await repository.deleteNotification({
  notificationId: req.params['notificationId'],
  userId: req.auth.userId,   // ownership enforced in SQL via AND user_id = $2
})
if (!deleted) throw new AppError(ErrorCode.NOTIFICATION_NOT_FOUND)
```

**Success** `HTTP 204`: no body

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| Not found or does not belong to user | `ErrorCode.NOTIFICATION_NOT_FOUND` |

---

### 7.5 Get Unread Count

```
GET /api/v1/notifications/unread-count
Auth: requireAuth
Body: none
```

**Important:** Register this route BEFORE the `/:notificationId` parameterised routes
so that Express does not match "unread-count" as a notification ID.

**Logic:**
```typescript
const count = await repository.getUnreadCount(req.auth.userId)
```

**Success** `HTTP 200`:
```json
{ "data": { "count": 7 } }
```

---

## 8. Repository Queries

All methods live in `notifications/notifications.repository.ts`. No SQL
anywhere else — not in handlers, not in the subscriber.

```typescript
// notifications.repository.ts

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
}

async function createNotification(
  db: Pool,
  input: CreateNotificationInput,
): Promise<void>
// INSERT INTO notifications (user_id, type, payload)
// VALUES ($1, $2, $3)
// — no RETURNING needed; fire and forget

export interface ListNotificationsInput {
  userId: string
  unreadOnly: boolean
  limit: number
  before: Date
}

async function listNotifications(
  db: Pool,
  input: ListNotificationsInput,
): Promise<Notification[]>
// SELECT * FROM notifications
// WHERE user_id = $1
//   AND created_at < $2
//   [AND is_read = FALSE  -- when unreadOnly]
// ORDER BY created_at DESC
// LIMIT $3

async function markOneRead(
  db: Pool,
  input: { notificationId: string; userId: string },
): Promise<boolean>
// UPDATE notifications
// SET is_read = TRUE
// WHERE id = $1 AND user_id = $2
// Returns true if rowCount > 0, false otherwise

async function markAllRead(
  db: Pool,
  userId: string,
): Promise<void>
// UPDATE notifications
// SET is_read = TRUE
// WHERE user_id = $1 AND is_read = FALSE

async function deleteNotification(
  db: Pool,
  input: { notificationId: string; userId: string },
): Promise<boolean>
// DELETE FROM notifications
// WHERE id = $1 AND user_id = $2
// Returns true if rowCount > 0, false otherwise

async function getUnreadCount(
  db: Pool,
  userId: string,
): Promise<number>
// SELECT COUNT(*) FROM notifications
// WHERE user_id = $1 AND is_read = FALSE
// Cast result to number: parseInt(rows[0].count, 10)
```

Export a factory function that closes over `db` so callers never pass `db`
directly. Example pattern:

```typescript
export function createNotificationRepository(db: Pool) {
  return {
    createNotification: (input: CreateNotificationInput) =>
      createNotification(db, input),
    listNotifications: (input: ListNotificationsInput) =>
      listNotifications(db, input),
    markOneRead: (input: { notificationId: string; userId: string }) =>
      markOneRead(db, input),
    markAllRead: (userId: string) => markAllRead(db, userId),
    deleteNotification: (input: { notificationId: string; userId: string }) =>
      deleteNotification(db, input),
    getUnreadCount: (userId: string) => getUnreadCount(db, userId),
  }
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>
```

---

## 9. NATS Subscriptions

Export a single startup function from the subscriber file. Call it from
`index.ts` after the DB connection is confirmed healthy.

### 9.1 Subscriber Startup (index.ts)

```typescript
// index.ts — after DB connects and before app.listen
import { startNotificationSubscribers } from './notifications/notifications.subscriber'

await startNotificationSubscribers(db)
logger.info({ service: 'notification-service' }, 'NATS subscribers started')
```

### 9.2 Subscriber File

```typescript
// notifications/notifications.subscriber.ts

import { subscribe, logger } from '@clickup/sdk'
import { TASK_EVENTS, COMMENT_EVENTS, TaskAssignedEvent, CommentCreatedEvent } from '@clickup/contracts'
import { createNotificationRepository } from './notifications.repository'
import type { Pool } from 'pg'

export async function startNotificationSubscribers(db: Pool): Promise<void> {
  const repository = createNotificationRepository(db)

  // --- Subscription 1: task.assigned → notify assignee ---
  await subscribe(
    TASK_EVENTS.ASSIGNED,
    async (payload: TaskAssignedEvent) => {
      // Guard: no assignee, or self-assignment
      if (!payload.assigneeId || payload.assigneeId === payload.assignedBy) {
        logger.debug({ payload }, 'task.assigned: skipping self-assignment or missing assignee')
        return
      }

      await repository.createNotification({
        userId: payload.assigneeId,
        type: 'task_assigned',
        payload: {
          taskId: payload.taskId,
          listId: payload.listId,
          workspaceId: payload.workspaceId,
          assignedBy: payload.assignedBy,
        },
      })

      logger.info(
        { taskId: payload.taskId, assigneeId: payload.assigneeId },
        'notification created: task_assigned',
      )
    },
    { durable: 'notif-svc-task-assigned' },
  )

  // --- Subscription 2: comment.created → notify mentioned users ---
  await subscribe(
    COMMENT_EVENTS.CREATED,
    async (payload: CommentCreatedEvent) => {
      if (!payload.mentionedUserIds || payload.mentionedUserIds.length === 0) {
        return
      }

      for (const userId of payload.mentionedUserIds) {
        // Skip: commenter cannot receive a mention notification from their own comment
        if (userId === payload.userId) continue

        await repository.createNotification({
          userId,
          type: 'task_mentioned',
          payload: {
            taskId: payload.taskId,
            commentId: payload.commentId,
            workspaceId: payload.workspaceId,
            mentionedBy: payload.userId,
          },
        })

        logger.info(
          { taskId: payload.taskId, mentionedUserId: userId },
          'notification created: task_mentioned',
        )
      }
    },
    { durable: 'notif-svc-comment-created' },
  )
}
```

### 9.3 Subscription Summary

| NATS Subject | Durable Consumer Name | Notification Type Created | Guard Condition |
|---|---|---|---|
| `TASK_EVENTS.ASSIGNED` | `notif-svc-task-assigned` | `task_assigned` | Skip if no `assigneeId` or `assigneeId === assignedBy` |
| `COMMENT_EVENTS.CREATED` | `notif-svc-comment-created` | `task_mentioned` | Skip per-user if `userId === payload.userId` |

---

## 10. Events to Publish

This wave does not require publishing NATS events from the notification service.
Do NOT add publish calls. Leave `NOTIFICATION_EVENTS` imported but unused for
the future real-time push wave.

> If a future WO adds real-time push (e.g. WebSocket), publishing on
> `NOTIFICATION_EVENTS.CREATED` after each `repository.createNotification`
> call is the correct extension point.

---

## 11. Routes Registration

```typescript
// routes.ts
import { Router } from 'express'
import { requireAuth } from '@clickup/sdk'
import {
  listNotifications,
  markOneRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
} from './notifications/notifications.handler'

export function createRouter(db: Pool): Router {
  const router = Router()

  // IMPORTANT: register /unread-count BEFORE /:notificationId
  router.get('/api/v1/notifications/unread-count',  requireAuth, asyncHandler(getUnreadCount(db)))
  router.get('/api/v1/notifications',               requireAuth, asyncHandler(listNotifications(db)))
  router.patch('/api/v1/notifications/:notificationId/read', requireAuth, asyncHandler(markOneRead(db)))
  router.post('/api/v1/notifications/read-all',     requireAuth, asyncHandler(markAllRead(db)))
  router.delete('/api/v1/notifications/:notificationId',     requireAuth, asyncHandler(deleteNotification(db)))

  return router
}
```

Each handler export is a factory that closes over `db` and returns an Express
`RequestHandler`. Example pattern:

```typescript
// notifications.handler.ts
export function listNotifications(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    // ... handler body
  }
}
```

---

## 12. .env.example

```dotenv
SERVICE_NAME=notification-service
PORT=3007
DATABASE_URL=postgres://clickup:clickup@localhost:5432/clickup
NATS_URL=nats://localhost:4222
JWT_SECRET=change-me-in-production
LOG_LEVEL=info
```

---

## 13. package.json

Start from `services/_template/package.json` and change:
- `"name"` → `"@clickup/notification-service"`
- Ensure `"@clickup/contracts"` and `"@clickup/sdk"` are listed in `dependencies`

No additional third-party dependencies are needed.

---

## 14. Mandatory Tests

### 14.1 Unit Tests (mock repository)

File: `tests/unit/notifications.subscriber.test.ts`

```
□ task.assigned: calls createNotification with type=task_assigned for valid payload
□ task.assigned: skips when assigneeId is undefined
□ task.assigned: skips when assigneeId === assignedBy (self-assignment)
□ task.assigned: payload stored contains { taskId, listId, workspaceId, assignedBy }
□ comment.created: calls createNotification for each mentionedUserId
□ comment.created: skips userId that matches payload.userId (commenter)
□ comment.created: skips all when mentionedUserIds is empty array
□ comment.created: payload stored contains { taskId, commentId, workspaceId, mentionedBy }
□ comment.created: creates notifications for 3 mentioned users (excluding commenter) — loop test
```

File: `tests/unit/notifications.handler.test.ts`

```
□ listNotifications: passes userId from req.auth, default limit 50, default before=now
□ listNotifications: passes unreadOnly=true when query param is "true"
□ listNotifications: caps limit at 100 even if query param is larger
□ markOneRead: calls repository.markOneRead with notificationId + userId
□ markOneRead: throws NOTIFICATION_NOT_FOUND when repository returns false
□ deleteNotification: throws NOTIFICATION_NOT_FOUND when repository returns false
□ getUnreadCount: returns { count: N } from repository result
```

### 14.2 Integration Tests (real DB, real NATS)

File: `tests/integration/notifications.handler.test.ts`

Use transaction rollback between tests:
```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async () => { await db.query('ROLLBACK') })
```

```
□ GET /api/v1/notifications → 200 with empty array when no notifications exist
□ GET /api/v1/notifications → 200 ordered by created_at DESC
□ GET /api/v1/notifications?unreadOnly=true → only unread returned
□ GET /api/v1/notifications?limit=2 → returns at most 2 items
□ GET /api/v1/notifications?before=<timestamp> → returns only older items
□ GET /api/v1/notifications without auth → 401 AUTH_MISSING_TOKEN
□ PATCH /api/v1/notifications/:id/read → 200, notification is_read = TRUE in DB
□ PATCH /api/v1/notifications/:id/read for another user's notification → 404 NOTIFICATION_NOT_FOUND
□ PATCH /api/v1/notifications/nonexistent-uuid/read → 404 NOTIFICATION_NOT_FOUND
□ POST /api/v1/notifications/read-all → 204, all user's unread set to is_read = TRUE
□ POST /api/v1/notifications/read-all when already all read → 204 (idempotent, no error)
□ DELETE /api/v1/notifications/:id → 204, row removed from DB
□ DELETE /api/v1/notifications/:id for another user's notification → 404 NOTIFICATION_NOT_FOUND
□ GET /api/v1/notifications/unread-count → 200 { count: 3 } (after inserting 3 unread)
□ GET /api/v1/notifications/unread-count → 200 { count: 0 } after read-all
□ GET /health → 200 with postgres "ok" and nats "ok"
```

File: `tests/integration/notifications.subscriber.test.ts`

```
□ Publish task.assigned → notification row created in DB with type=task_assigned
□ Publish task.assigned for self-assignment → no notification row created
□ Publish task.assigned with no assigneeId → no notification row created
□ Publish comment.created with mentionedUserIds=[A, B] → two rows created (one per user)
□ Publish comment.created where commenter is in mentionedUserIds → commenter row NOT created
□ Publish comment.created with empty mentionedUserIds → no rows created
```

---

## 15. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ GET /health returns 200 with postgres "ok" and nats "ok"
□ NATS subscribers start on service boot (logged at INFO level)
□ Notifications created for task.assigned events verified by integration test
□ No console.log anywhere in src/ — use logger
□ No raw Error thrown anywhere in src/ — only AppError(ErrorCode.X)
□ No SQL in handler or subscriber files — only in notifications.repository.ts
□ packages/contracts not modified
□ packages/sdk not modified
□ .env file not committed (only .env.example)
□ PR description: "Notification Service — persists in-app notifications from domain events"
```

---

## 16. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables or run migrations (notifications table already exists)
✗ Do NOT write SQL in notifications.handler.ts or notifications.subscriber.ts
✗ Do NOT call any other microservice over HTTP (no service-to-service calls needed)
✗ Do NOT implement email or push notifications (in-app only in this wave)
✗ Do NOT publish NATS events (deferred to real-time push wave)
✗ Do NOT implement WebSocket in this service (that is api-gateway's responsibility)
✗ Do NOT add soft-delete — hard DELETE is correct for notifications
✗ Do NOT add caching — notifications are user-specific and low-volume
✗ Do NOT use console.log — logger from @clickup/sdk only
✗ Do NOT throw raw Error — AppError(ErrorCode.X) only
✗ Do NOT commit .env
```
