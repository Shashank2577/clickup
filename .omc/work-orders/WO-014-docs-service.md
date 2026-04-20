# Work Order — Docs Service
**Wave:** 3
**Session ID:** WO-014
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-003 (identity-service), WO-004 (api-gateway), WO-005 (task-service)
**Branch name:** `wave3/docs-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Docs Service provides collaborative document editing for workspaces. It owns
the `docs` table and exposes HTTP endpoints for document lifecycle management (create,
read, update metadata, delete). Real-time collaborative editing is powered by Y.js
CRDT over WebSocket: multiple users can simultaneously edit the same document and
their changes are merged automatically without conflicts. Snapshots of Y.js state
are persisted to `doc_snapshots` every 30 seconds so documents survive service
restarts and no editing progress is lost. When a task is deleted, the service
automatically soft-deletes any docs linked to that task via a NATS subscription.

---

## 2. Context: How This Service Fits

```
Client (HTTP)
  → API Gateway (:3000)
    → docs-service (:3004)
      → PostgreSQL (tables: docs, doc_snapshots)
      → identity-service (:3001) HTTP: verify workspace membership
      ↘ NATS publishes:
          doc.created
          doc.updated
          doc.deleted
      ← NATS subscribes:
          task.deleted  → soft-delete docs linked to that task

Client (WebSocket)
  → API Gateway (:3000) [ws proxy]
    → docs-service (:3004) WebSocket /ws/docs/:docId
        Y.js sync protocol (y-websocket server)
        Auth: JWT via ?token= query param
        Persist snapshot every 30s to doc_snapshots
        Load latest snapshot on client reconnect
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/docs-service
cd services/docs-service

# In package.json change:
# "name": "@clickup/docs-service"

cp .env.example .env
# Edit: SERVICE_NAME=docs-service
# Edit: PORT=3004
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
```

---

## 4. Files to Create

```
services/docs-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=docs-service, PORT=3004]
│   │                                   [wire up NATS subscription + WebSocket server in startup]
│   ├── routes.ts                       [register all HTTP routes]
│   ├── docs/
│   │   ├── docs.handler.ts             [HTTP handlers — no SQL, no business logic]
│   │   ├── docs.service.ts             [business logic, auth checks, event publishing]
│   │   └── docs.repository.ts          [all DB queries — no business logic here]
│   └── ws/
│       ├── ws.server.ts                [Y.js WebSocket server setup, snapshot loop]
│       └── ws.auth.ts                  [JWT extraction from ?token= query param]
├── tests/
│   ├── unit/
│   │   └── docs.service.test.ts        [mock repository, test logic in isolation]
│   └── integration/
│       └── docs.handler.test.ts        [real DB via transaction rollback, test HTTP layer]
├── package.json                        [name: @clickup/docs-service]
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
  Doc,
  DocSummary,
  // Schemas (for validate() — never write manual validation)
  CreateDocSchema,
  UpdateDocSchema,
  // Error codes
  ErrorCode,
  // Event subjects + payload types
  DOC_EVENTS,
  DocCreatedEvent,
  DocUpdatedEvent,
  // Task event type for subscription
  TASK_EVENTS,
  TaskDeletedEvent,
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

// Y.js collaborative editing
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { setupWSConnection } from 'y-websocket/bin/utils'
import * as ws from 'ws'
```

---

## 6. Database Tables

The tables below **already exist** in PostgreSQL. Do NOT generate migrations or
CREATE TABLE statements. Do NOT alter column names — use them exactly as shown.

| Table | Access | Notes |
|-------|--------|-------|
| `docs` | READ + WRITE | Core entity. Always filter `deleted_at IS NULL` in reads |
| `doc_snapshots` | READ + WRITE | Y.js state persistence; create via migration below |
| `users` | READ ONLY | JOIN for `id`, `name`, `avatar_url` on doc reads |
| `workspaces` | READ ONLY | Verify workspace exists before creating a doc |
| `workspace_members` | READ ONLY | Verify user is a member of the workspace |

### doc_snapshots table — create via new migration

The `doc_snapshots` table does NOT exist in the current migrations. You must create
migration `infra/migrations/003_doc_snapshots.sql` with the following DDL:

> **IMPORTANT:** Check if `003_add_password_hash.sql` already exists. If it does,
> use `004_doc_snapshots.sql` as the filename to avoid collision.

```sql
-- Migration: doc_snapshots table for Y.js state persistence
CREATE TABLE doc_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  state_vector  BYTEA NOT NULL,    -- Y.js encoded state vector (Uint8Array)
  update_data   BYTEA NOT NULL,    -- Y.js encoded document update (Uint8Array)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the latest snapshot matters per doc; index for fast lookup
CREATE INDEX idx_doc_snapshots_doc_created
  ON doc_snapshots (doc_id, created_at DESC);
```

### Schema reference for docs table (do not recreate — for column names only)

```sql
-- docs
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
title         TEXT NOT NULL DEFAULT 'Untitled'
content       JSONB NOT NULL DEFAULT '{}'
parent_id     UUID REFERENCES docs(id) ON DELETE CASCADE
path          TEXT NOT NULL
is_public     BOOLEAN NOT NULL DEFAULT FALSE
created_by    UUID NOT NULL REFERENCES users(id)
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at    TIMESTAMPTZ
```

### Path computation for docs (mirrors task materialized path pattern)

```typescript
// Root doc in workspace:
const path = `/${workspaceId}/${newDocId}/`

// Nested doc (child of a parent doc):
const path = `${parentDoc.path}${newDocId}/`

// Fetch all docs in workspace (any depth):
const query = `
  SELECT * FROM docs
  WHERE workspace_id = $1
    AND deleted_at IS NULL
  ORDER BY path, created_at
`

// Fetch all descendants of a doc:
const query = `
  SELECT * FROM docs
  WHERE path LIKE $1 || '%'
    AND id != $2
    AND deleted_at IS NULL
  ORDER BY path
`
// params: [doc.path, doc.id]
```

### Standard doc fetch query (copy this — do not write your own)

```sql
-- Use for single doc GET
SELECT
  d.*,
  u.id         AS creator_user_id,
  u.name       AS creator_name,
  u.avatar_url AS creator_avatar
FROM docs d
JOIN users u ON u.id = d.created_by
WHERE d.id = $1
  AND d.deleted_at IS NULL
```

### Latest snapshot fetch query

```sql
-- Load latest Y.js snapshot on WebSocket reconnect
SELECT state_vector, update_data
FROM doc_snapshots
WHERE doc_id = $1
ORDER BY created_at DESC
LIMIT 1
```

---

## 7. API Endpoints

All routes are registered in `routes.ts`. All handlers call `asyncHandler()` from
the SDK. All body parsing uses `validate(Schema, req.body)` — no manual validation.

---

### 7.1 Create Doc

```
POST /api/v1/docs
Auth: requireAuth
Body: CreateDocSchema  { title?: string, workspaceId: string, parentId?: string (UUID) }
```

**Handler steps (in docs.service.ts):**

1. Call `validate(CreateDocSchema, req.body)`.
2. Verify workspace exists and user is a member (see Section 10).
3. If `parentId` provided, verify the parent doc exists and belongs to the same workspace:
   ```typescript
   const parent = await docsRepository.getDoc(input.parentId)
   if (!parent || parent.workspaceId !== input.workspaceId) {
     throw new AppError(ErrorCode.DOC_NOT_FOUND)
   }
   ```
4. Generate new UUID, compute path:
   ```typescript
   import { randomUUID } from 'crypto'
   const newId = randomUUID()
   const path = parent
     ? `${parent.path}${newId}/`
     : `/${input.workspaceId}/${newId}/`
   ```
5. Insert the row via `docsRepository.createDoc(...)`.
6. **After** the insert (never inside a transaction): publish `DOC_EVENTS.CREATED`.
7. Return `HTTP 201` with `{ data: doc }`.

**Insert query (in docs.repository.ts):**

```sql
INSERT INTO docs (id, workspace_id, title, content, parent_id, path, is_public, created_by)
VALUES ($1, $2, $3, '{}', $4, $5, FALSE, $6)
RETURNING *
```

**Event payload:**

```typescript
await publish(DOC_EVENTS.CREATED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  title:       doc.title,
  createdBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies DocCreatedEvent)
```

**Success** `HTTP 201`:
```json
{ "data": { /* Doc */ } }
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| workspaceId not found | `ErrorCode.WORKSPACE_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| parentId not found / wrong workspace | `ErrorCode.DOC_NOT_FOUND` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.2 Get Doc

```
GET /api/v1/docs/:docId
Auth: requireAuth
Body: none
```

**Handler steps:**

1. Fetch the doc using the standard query (Section 6).
2. If not found or `deleted_at IS NOT NULL`: `throw new AppError(ErrorCode.DOC_NOT_FOUND)`.
3. Verify the requesting user is a member of `doc.workspaceId` (Section 10).
4. Return `HTTP 200` with `{ data: doc }`.

**Response shape:**

```typescript
{
  id:          string   // UUID
  workspaceId: string
  title:       string
  content:     Record<string, unknown>  // ProseMirror/TipTap JSON
  parentId:    string | null
  path:        string
  isPublic:    boolean
  createdBy:   string
  createdAt:   string   // ISO 8601
  updatedAt:   string
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Not found or deleted | `ErrorCode.DOC_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.3 Update Doc (Title / Meta Only)

```
PATCH /api/v1/docs/:docId
Auth: requireAuth
Body: UpdateDocSchema  { title?: string, isPublic?: boolean }
```

> **IMPORTANT:** This endpoint updates ONLY title and isPublic metadata. Document
> content is managed exclusively through the Y.js WebSocket connection — never
> update the `content` JSONB column via this HTTP endpoint.

**Handler steps:**

1. Call `validate(UpdateDocSchema, req.body)`.
2. Fetch the doc: `await docsRepository.getDoc(docId)`.
3. If not found or deleted: `throw new AppError(ErrorCode.DOC_NOT_FOUND)`.
4. Verify workspace membership (Section 10).
5. Update via repository:
   ```sql
   UPDATE docs
   SET title     = COALESCE($2, title),
       is_public = COALESCE($3, is_public),
       updated_at = NOW()
   WHERE id = $1
     AND deleted_at IS NULL
   RETURNING *
   ```
6. Publish `DOC_EVENTS.UPDATED` after DB write.
7. Return `HTTP 200` with `{ data: updatedDoc }`.

**Event payload:**

```typescript
await publish(DOC_EVENTS.UPDATED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  updatedBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies DocUpdatedEvent)
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Doc not found / deleted | `ErrorCode.DOC_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |
| Body fails schema | `ErrorCode.VALIDATION_INVALID_INPUT` |

---

### 7.4 Delete Doc (Soft Delete)

```
DELETE /api/v1/docs/:docId
Auth: requireAuth
```

**Handler steps:**

1. Fetch the doc.
2. If not found or already deleted: `throw new AppError(ErrorCode.DOC_NOT_FOUND)`.
3. Verify workspace membership (Section 10).
4. Soft-delete the doc AND all descendants in one query:
   ```sql
   UPDATE docs
   SET deleted_at = NOW()
   WHERE path LIKE $1 || '%'
     AND deleted_at IS NULL
   ```
   Pass `$1 = doc.path`.
5. Publish `DOC_EVENTS.DELETED` after DB write.
6. Return `HTTP 204` with no body.

**Event payload:**

```typescript
await publish(DOC_EVENTS.DELETED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  deletedBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
})
```

**Note:** There is no `DocDeletedEvent` type in contracts. Use an inline object
shaped as `{ docId, workspaceId, deletedBy, occurredAt }`.

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Doc not found / deleted | `ErrorCode.DOC_NOT_FOUND` |
| User not in workspace | `ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED` |

---

### 7.5 WebSocket — Y.js Collaborative Editing

```
WebSocket /ws/docs/:docId
Auth: JWT via ?token= query parameter (NOT Authorization header)
```

**Implementation in `ws/ws.server.ts`:**

Y.js collaborative editing uses the `y-websocket` server utilities. The WebSocket
server runs on the same HTTP server instance (using the `upgrade` event), not on a
separate port.

```typescript
// ws/ws.server.ts

import * as http from 'http'
import * as ws from 'ws'
import * as Y from 'yjs'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { verifyJwt } from './ws.auth'
import { docsRepository } from '../docs/docs.repository'
import { logger } from '@clickup/sdk'

const SNAPSHOT_INTERVAL_MS = 30_000  // 30 seconds

// Map of docId → { ydoc, snapshotTimer }
const activeDocs = new Map<string, { ydoc: Y.Doc; timer: NodeJS.Timeout }>()

export function attachWebSocketServer(httpServer: http.Server): void {
  const wss = new ws.WebSocketServer({ noServer: true })

  httpServer.on('upgrade', async (req, socket, head) => {
    // Only handle /ws/docs/:docId paths
    const match = req.url?.match(/^\/ws\/docs\/([0-9a-f-]+)(\?.*)?$/)
    if (!match) { socket.destroy(); return }

    const docId = match[1]

    // Authenticate via ?token= query param
    const url = new URL(req.url!, `http://localhost`)
    const token = url.searchParams.get('token')
    if (!token) { socket.destroy(); return }

    let userId: string
    try {
      const payload = await verifyJwt(token)
      userId = payload.userId
    } catch {
      socket.destroy()
      return
    }

    // Verify the doc exists and user has access (DB check)
    const doc = await docsRepository.getDocById(docId)
    if (!doc) { socket.destroy(); return }

    // Verify workspace membership (DB check against workspace_members)
    const isMember = await docsRepository.isWorkspaceMember(doc.workspaceId, userId)
    if (!isMember) { socket.destroy(); return }

    wss.handleUpgrade(req, socket, head, (wsConn) => {
      wss.emit('connection', wsConn, req, docId, userId)
    })
  })

  wss.on('connection', async (wsConn, req, docId: string, userId: string) => {
    // Get or create Y.Doc for this docId
    if (!activeDocs.has(docId)) {
      const ydoc = new Y.Doc()

      // Load latest snapshot from DB on first connection
      const snapshot = await docsRepository.getLatestSnapshot(docId)
      if (snapshot) {
        Y.applyUpdate(ydoc, snapshot.updateData)
      }

      // Start 30-second snapshot persistence loop
      const timer = setInterval(async () => {
        try {
          const stateVector = Y.encodeStateVector(ydoc)
          const updateData  = Y.encodeStateAsUpdate(ydoc)
          await docsRepository.saveSnapshot(docId, stateVector, updateData)
          logger.info({ docId }, 'Y.js snapshot persisted')
        } catch (err) {
          logger.error({ err, docId }, 'Failed to persist Y.js snapshot')
        }
      }, SNAPSHOT_INTERVAL_MS)

      activeDocs.set(docId, { ydoc, timer })
    }

    const { ydoc } = activeDocs.get(docId)!

    // y-websocket handles all protocol framing
    setupWSConnection(wsConn, req, { docName: docId, gc: true })

    wsConn.on('close', () => {
      // If no more clients for this doc, persist final snapshot and clean up
      // y-websocket tracks awareness — check client count via docName
      // Simple approach: let the timer handle it; clear on last client
      const entry = activeDocs.get(docId)
      if (entry && wss.clients.size === 0) {
        clearInterval(entry.timer)
        activeDocs.delete(docId)
      }
    })

    logger.info({ docId, userId }, 'WebSocket client connected to doc')
  })
}
```

**JWT auth helper (`ws/ws.auth.ts`):**

```typescript
// ws/ws.auth.ts
import jwt from 'jsonwebtoken'

interface JwtPayload { userId: string; email: string }

export function verifyJwt(token: string): JwtPayload {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.verify(token, secret) as JwtPayload
}
```

**Snapshot repository queries (add to docs.repository.ts):**

```typescript
// Load latest snapshot (called on WebSocket connect)
async getLatestSnapshot(docId: string): Promise<{ stateVector: Buffer; updateData: Buffer } | null> {
  const result = await db.query<{ state_vector: Buffer; update_data: Buffer }>(`
    SELECT state_vector, update_data
    FROM doc_snapshots
    WHERE doc_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [docId])
  if (!result.rows[0]) return null
  return {
    stateVector: result.rows[0].state_vector,
    updateData:  result.rows[0].update_data,
  }
}

// Persist Y.js snapshot (called every 30s from interval)
async saveSnapshot(docId: string, stateVector: Uint8Array, updateData: Uint8Array): Promise<void> {
  await db.query(`
    INSERT INTO doc_snapshots (doc_id, state_vector, update_data)
    VALUES ($1, $2, $3)
  `, [docId, Buffer.from(stateVector), Buffer.from(updateData)])
}

// Verify workspace membership (for WebSocket auth)
async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const result = await db.query(`
    SELECT 1 FROM workspace_members
    WHERE workspace_id = $1
      AND user_id = $2
    LIMIT 1
  `, [workspaceId, userId])
  return result.rowCount! > 0
}
```

---

## 8. Events to Publish

All events must be published **after** the DB write completes, never inside a
database transaction.

| Trigger | NATS Subject (via constant) | Payload Type |
|---------|-----------------------------|--------------|
| Doc created | `DOC_EVENTS.CREATED` | `DocCreatedEvent` |
| Doc metadata updated | `DOC_EVENTS.UPDATED` | `DocUpdatedEvent` |
| Doc soft-deleted | `DOC_EVENTS.DELETED` | inline object |

For `DOC_EVENTS.CREATED`:

```typescript
await publish(DOC_EVENTS.CREATED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  title:       doc.title,
  createdBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies DocCreatedEvent)
```

For `DOC_EVENTS.UPDATED`:

```typescript
await publish(DOC_EVENTS.UPDATED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  updatedBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
} satisfies DocUpdatedEvent)
```

For `DOC_EVENTS.DELETED`:

```typescript
await publish(DOC_EVENTS.DELETED, {
  docId:       doc.id,
  workspaceId: doc.workspaceId,
  deletedBy:   req.auth.userId,
  occurredAt:  new Date().toISOString(),
})
```

> The Y.js WebSocket content sync does NOT publish `doc.updated` events — that
> would flood NATS. Only the HTTP PATCH endpoint for title/meta publishes `doc.updated`.

---

## 9. NATS Subscriptions

Subscriptions are set up in `src/index.ts` **after** the HTTP server starts
listening and the DB pool is ready. They are **not** in any handler file.

```typescript
// src/index.ts — inside the startup async function, after server.listen(...)

await subscribe(
  TASK_EVENTS.DELETED,
  async (payload: TaskDeletedEvent) => {
    try {
      // Soft-delete all docs linked to the deleted task
      // In this wave, docs are linked to tasks via task_id stored in content
      // or by convention: docs where path contains the taskId are cascade-deleted.
      // For simplicity: soft-delete docs whose content JSONB has taskId = payload.taskId
      await db.query(`
        UPDATE docs
        SET deleted_at = NOW()
        WHERE content->>'taskId' = $1
          AND deleted_at IS NULL
      `, [payload.taskId])
      logger.info({ taskId: payload.taskId }, 'Soft-deleted docs for deleted task')
    } catch (err) {
      logger.error({ err, taskId: payload.taskId }, 'Failed to soft-delete task docs')
      throw err  // rethrow so NATS can redeliver
    }
  },
  { durable: 'docs-svc-task-deleted' }
)
```

Rules:
- Use `logger.info` / `logger.error` — never `console.log`.
- Wrap the handler body in `try/catch`; on error call `logger.error` and re-throw
  so NATS can redeliver (do not swallow errors silently).
- The `durable` option ensures the subscription survives service restarts.

---

## 10. Service-to-Service Calls

The docs service calls identity-service to verify that the requesting user is a
member of the workspace before any write operation.

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

| Service | Why | Endpoint |
|---------|-----|----------|
| identity-service | Verify user is a workspace member | `GET /api/v1/workspaces/:id/members/:userId` |

---

## 11. Caching Rules

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Workspace member check | Tier 2 (60s) | `CacheKeys.workspaceMembers(workspaceId)` | Never — let expire |
| Doc metadata (GET /docs/:docId) | Tier 3 (5min) | `CacheKeys.doc(docId)` | On PATCH or DELETE |

```typescript
// Cache-aside pattern for GET /docs/:docId
const cached = await tier3Get<Doc>(CacheKeys.doc(docId))
if (cached !== null) return cached

const doc = await docsRepository.getDoc(docId)
if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)
await tier3Set(CacheKeys.doc(docId), doc)
return doc

// Invalidate on PATCH or DELETE
await tier3Del(CacheKeys.doc(docId))
```

> Note: `CacheKeys.doc(docId)` must be added to `packages/sdk/src/cache/keys.ts`
> if it does not already exist. If the key builder is not present, construct the
> key inline as `doc:${docId}` using `tier3Get`/`tier3Set` directly.

---

## 12. Mandatory Tests

### 12.1 Unit Tests — `tests/unit/docs.service.test.ts`

Mock the repository layer. Test the service in isolation.

```
□ createDoc: inserts doc with correct path for root doc (no parent)
□ createDoc: inserts doc with correct path when parentId provided (parent.path + newId + /)
□ createDoc: throws WORKSPACE_NOT_FOUND when workspace does not exist
□ createDoc: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ createDoc: throws DOC_NOT_FOUND when parentId provided but not found
□ createDoc: throws DOC_NOT_FOUND when parentId belongs to different workspace
□ createDoc: publishes DOC_EVENTS.CREATED after DB insert
□ createDoc: does NOT publish event when DB insert throws
□ getDoc: throws DOC_NOT_FOUND when doc does not exist
□ getDoc: throws DOC_NOT_FOUND when doc is soft-deleted
□ getDoc: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ updateDoc: throws DOC_NOT_FOUND when doc not found or deleted
□ updateDoc: throws AUTH_WORKSPACE_ACCESS_DENIED when user not in workspace
□ updateDoc: updates title only, leaves other fields unchanged
□ updateDoc: updates isPublic only, leaves other fields unchanged
□ updateDoc: publishes DOC_EVENTS.UPDATED after DB update
□ deleteDoc: soft-deletes doc and all descendants (path LIKE pattern)
□ deleteDoc: publishes DOC_EVENTS.DELETED after soft-delete
□ deleteDoc: throws DOC_NOT_FOUND when not found or already deleted
□ NATS task.deleted handler: soft-deletes docs with matching taskId in content
```

### 12.2 Integration Tests — `tests/integration/docs.handler.test.ts`

Use a real PostgreSQL database. Wrap every test in a transaction rolled back in
`afterEach` to ensure isolation.

```typescript
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async ()  => { await db.query('ROLLBACK') })
```

```
□ POST /api/v1/docs → 201, body matches Doc shape
□ POST /api/v1/docs without auth → 401 AUTH_MISSING_TOKEN
□ POST /api/v1/docs missing workspaceId → 422 VALIDATION_INVALID_INPUT
□ POST /api/v1/docs with non-existent workspaceId → 404 WORKSPACE_NOT_FOUND
□ POST /api/v1/docs with valid parentId → 201, path = parent.path + newId + /
□ POST /api/v1/docs with parentId from different workspace → 404 DOC_NOT_FOUND
□ GET /api/v1/docs/:docId → 200 with doc fields
□ GET /api/v1/docs/:docId with invalid UUID → 422 VALIDATION_INVALID_UUID
□ GET /api/v1/docs/:docId not found → 404 DOC_NOT_FOUND
□ GET /api/v1/docs/:docId soft-deleted → 404 DOC_NOT_FOUND
□ GET /api/v1/docs/:docId in another workspace → 404 (not 403 — do not leak existence)
□ PATCH /api/v1/docs/:docId → 200, title updated in response
□ PATCH /api/v1/docs/:docId → content field not changed (HTTP PATCH ignores content)
□ PATCH /api/v1/docs/:docId not found → 404 DOC_NOT_FOUND
□ DELETE /api/v1/docs/:docId → 204, doc excluded from subsequent GET
□ DELETE /api/v1/docs/:docId → descendant docs also soft-deleted
□ DELETE /api/v1/docs/:docId not found → 404 DOC_NOT_FOUND
□ GET /health → 200 with { postgres: "ok", nats: "ok" }
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
□ No SQL in handler or service files — only in docs.repository.ts
□ Events published AFTER DB write, never inside a DB transaction
□ NATS subscription for task.deleted wired up in index.ts startup
□ WebSocket server attaches to HTTP server via upgrade event (not separate port)
□ Y.js snapshot persisted every 30 seconds to doc_snapshots table
□ Latest Y.js snapshot loaded from DB on WebSocket reconnect
□ WebSocket auth via ?token= query param (not Authorization header)
□ Migration file for doc_snapshots created (check for filename collision)
□ .env file is NOT committed (only .env.example is committed)
□ packages/contracts and packages/sdk are not modified
□ PR description: "Docs Service — collaborative Y.js document editing with PostgreSQL snapshot persistence"
```

---

## 14. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create any DB tables other than doc_snapshots (via migration)
✗ Do NOT use console.log — use logger
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X)
✗ Do NOT write SQL in handler or service files — repository files only
✗ Do NOT write manual validation — use validate(Schema, data) from SDK
✗ Do NOT update document content via HTTP PATCH — content is Y.js only
✗ Do NOT hard-delete docs — always set deleted_at
✗ Do NOT publish events inside a DB transaction
✗ Do NOT run the WebSocket server on a separate port — attach to same HTTP server
✗ Do NOT publish doc.updated on every Y.js sync message — only on HTTP PATCH
✗ Do NOT call task-service via HTTP — subscribe to NATS task.deleted instead
✗ Do NOT commit the .env file
```

---

## 15. Allowed Additional Dependencies

```json
{
  "yjs": "^13.6.0",
  "y-websocket": "^1.5.0",
  "ws": "^8.0.0",
  "jsonwebtoken": "^9.0.0"
}
```

`ws` is required for the WebSocket server. `jsonwebtoken` is for WebSocket JWT
verification (the HTTP layer uses the SDK's `requireAuth` which handles its own
JWT verification, but WebSocket auth must be done manually from the query param
before the upgrade handshake completes).
