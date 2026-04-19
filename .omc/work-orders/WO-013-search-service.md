# Work Order — Search Service
**Wave:** 2
**Session ID:** WO-013
**Depends on:** WO-001 (contracts), WO-002 (sdk), WO-005 (task-service), WO-010 (comment-service)
**Branch name:** `wave2/search-service`
**Estimated time:** 2 hours

---

## 1. Mission

The Search Service provides full-text search across tasks (and future content
types) for the ClickUp OSS platform. It owns a single ElasticSearch index and
keeps it up to date by subscribing to domain events published by other services.
It exposes a read-only HTTP search endpoint so the frontend can deliver
instant, relevance-ranked results filtered strictly to the requesting user's
workspace. This service has NO PostgreSQL dependency — ElasticSearch is the
sole data store. It never initiates writes from HTTP; all writes to the index
come exclusively from NATS event handlers.

---

## 2. Context: How This Service Fits

```
task-service  ──► NATS: task.created  ──►
task-service  ──► NATS: task.updated  ──► search-service (:3008)
task-service  ──► NATS: task.deleted  ──►       │
                                                 ├─► ElasticSearch (:9200)
                                                 │   index: clickup_tasks
Client                                           │
  → API Gateway (:3000)                          │
    → search-service (:3008) ◄───────────────────┘
        GET  /api/v1/search

search-service subscribes:
    TASK_EVENTS.CREATED  (durable: search-svc-task-created)
    TASK_EVENTS.UPDATED  (durable: search-svc-task-updated)
    TASK_EVENTS.DELETED  (durable: search-svc-task-deleted)

search-service publishes:
    nothing — read-only via HTTP
```

ElasticSearch is already running in docker-compose at `localhost:9200`. Do NOT
add a new docker-compose entry. Do NOT add any PostgreSQL dependency.

---

## 3. Repository Setup

```bash
cp -r services/_template services/search-service
cd services/search-service

# In package.json change:
# "name": "@clickup/search-service"

# Add the ElasticSearch client:
pnpm add @elastic/elasticsearch

cp .env.example .env
# Edit: SERVICE_NAME=search-service
# Edit: PORT=3008
# Edit: ELASTICSEARCH_URL=http://localhost:9200
```

---

## 4. Files to Create

```
services/search-service/
├── src/
│   ├── index.ts                       [copy _template; SERVICE_NAME=search-service, PORT=3008]
│   ├── routes.ts                      [register search route]
│   └── search/
│       ├── search.handler.ts          [HTTP GET /api/v1/search handler]
│       ├── search.indexer.ts          [NATS subscribers — writes to ES]
│       └── elastic.client.ts          [ES client factory + ensureIndex]
├── tests/
│   └── unit/
│       ├── search.handler.test.ts     [unit tests — mock ES client]
│       └── search.indexer.test.ts     [unit tests — mock ES client]
├── package.json
├── tsconfig.json
└── .env.example
```

No `service.ts` layer is needed — the indexer and handler call the ES client
directly. The search domain has no complex business logic that warrants a
separate service layer.

---

## 5. Imports

```typescript
// From @clickup/contracts  (READ ONLY — never modify this package)
import {
  // Event subjects
  TASK_EVENTS,
  COMMENT_EVENTS,
  // Event payload interfaces
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  // Error codes
  ErrorCode,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,    // Express middleware: populates req.auth, throws 401 on failure
  asyncHandler,   // wraps async route handlers, forwards errors to next()
  validate,       // Zod validation middleware for req.query / req.body
  AppError,       // only way to throw domain errors — never throw raw Error
  subscribe,      // subscribe to a durable NATS consumer
  logger,         // structured logger — never use console.log
} from '@clickup/sdk'

// Third-party
import { Client } from '@elastic/elasticsearch'
```

`SearchQuerySchema` does NOT exist in `@clickup/contracts`. Define it inline in
`search.handler.ts` (see Section 7.3).

---

## 6. ElasticSearch Index Design

One index: `clickup_tasks`. Create it on service startup if it does not already
exist. Do NOT create any PostgreSQL tables or run any SQL migrations.

### 6.1 Index Mapping

```json
{
  "mappings": {
    "properties": {
      "id":          { "type": "keyword" },
      "type":        { "type": "keyword" },
      "workspaceId": { "type": "keyword" },
      "listId":      { "type": "keyword" },
      "title":       { "type": "text", "analyzer": "standard" },
      "description": { "type": "text", "analyzer": "standard" },
      "status":      { "type": "keyword" },
      "priority":    { "type": "keyword" },
      "assigneeId":  { "type": "keyword" },
      "createdBy":   { "type": "keyword" },
      "createdAt":   { "type": "date" },
      "updatedAt":   { "type": "date" },
      "tags":        { "type": "keyword" }
    }
  }
}
```

### 6.2 elastic.client.ts — Full Implementation

```typescript
// search/elastic.client.ts
import { Client } from '@elastic/elasticsearch'
import { logger } from '@clickup/sdk'

export const INDEX = 'clickup_tasks'

export function createElasticClient(): Client {
  return new Client({
    node: process.env['ELASTICSEARCH_URL'] ?? 'http://localhost:9200',
  })
}

export async function ensureIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: INDEX })
  if (exists) {
    logger.info({ index: INDEX }, 'ES index already exists — skipping creation')
    return
  }

  await client.indices.create({
    index: INDEX,
    body: {
      mappings: {
        properties: {
          id:          { type: 'keyword' },
          type:        { type: 'keyword' },
          workspaceId: { type: 'keyword' },
          listId:      { type: 'keyword' },
          title:       { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          status:      { type: 'keyword' },
          priority:    { type: 'keyword' },
          assigneeId:  { type: 'keyword' },
          createdBy:   { type: 'keyword' },
          createdAt:   { type: 'date' },
          updatedAt:   { type: 'date' },
          tags:        { type: 'keyword' },
        },
      },
    },
  })

  logger.info({ index: INDEX }, 'ES index created')
}
```

---

## 7. API Endpoints

### 7.1 Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/search` | `requireAuth` | Full-text search across indexed content |

This service exposes **no write endpoints**. All index mutations happen through
NATS event handlers.

---

### 7.2 GET /api/v1/search

```
GET /api/v1/search?q=...&workspaceId=...&types=task,comment&listId=...&page=1&pageSize=20
Auth: requireAuth
```

**Query parameters** (validated via inline `SearchQuerySchema`):

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `q` | `string` | yes | min 1, max 200 chars |
| `workspaceId` | `string (UUID)` | yes | security anchor — always filtered |
| `types` | `string[]` (enum: `task`, `comment`) | no | filter by document type |
| `listId` | `string (UUID)` | no | narrow to a specific list |
| `page` | `integer` | no | min 1, default 1 |
| `pageSize` | `integer` | no | min 1, max 50, default 20 |

**Success** `HTTP 200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "task",
      "title": "Fix login bug",
      "snippet": "First 200 chars of description, or ES highlight excerpt",
      "workspaceId": "uuid",
      "listId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**Errors:**

| Condition | ErrorCode |
|-----------|-----------|
| Missing or invalid auth token | `ErrorCode.AUTH_MISSING_TOKEN` |
| Query param fails Zod validation | `ErrorCode.SEARCH_INVALID_QUERY` |
| ES cluster unreachable or returns 5xx | `ErrorCode.SEARCH_UNAVAILABLE` |

---

### 7.3 SearchQuerySchema (inline — do NOT import from contracts)

Define this in `search.handler.ts`, not in a shared package:

```typescript
import { z } from 'zod'

const SearchQuerySchema = z.object({
  q:           z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  types:       z.array(z.enum(['task', 'comment'])).optional(),
  listId:      z.string().uuid().optional(),
  page:        z.number().int().min(1).default(1),
  pageSize:    z.number().int().min(1).max(50).default(20),
})

type SearchQuery = z.infer<typeof SearchQuerySchema>
```

Use `validate` from `@clickup/sdk` to apply this schema to `req.query` before
the handler body runs. If validation fails, throw
`new AppError(ErrorCode.SEARCH_INVALID_QUERY)`.

---

### 7.4 Handler Logic (search.handler.ts)

```typescript
// search/search.handler.ts
import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler, requireAuth, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { Client } from '@elastic/elasticsearch'
import { INDEX } from './elastic.client'

const SearchQuerySchema = z.object({
  q:           z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  types:       z.array(z.enum(['task', 'comment'])).optional(),
  listId:      z.string().uuid().optional(),
  page:        z.number().int().min(1).default(1),
  pageSize:    z.number().int().min(1).max(50).default(20),
})

export interface SearchResult {
  id:          string
  type:        string
  title:       string
  snippet:     string
  workspaceId: string
  listId:      string | null
  createdAt:   string
}

export function searchHandler(elastic: Client) {
  return async (req: Request, res: Response): Promise<void> => {
    // 1. Parse and validate query params
    const parseResult = SearchQuerySchema.safeParse({
      q:           req.query['q'],
      workspaceId: req.query['workspaceId'],
      types:       req.query['types']
        ? String(req.query['types']).split(',')
        : undefined,
      listId:      req.query['listId'],
      page:        req.query['page']     ? Number(req.query['page'])     : 1,
      pageSize:    req.query['pageSize'] ? Number(req.query['pageSize']) : 20,
    })

    if (!parseResult.success) {
      throw new AppError(ErrorCode.SEARCH_INVALID_QUERY)
    }

    const { q, workspaceId, types, listId, page, pageSize } = parseResult.data

    // 2. Security: always verify the requesting user belongs to this workspace.
    //    The workspaceId param is the security anchor — only index
    //    documents with workspaceId matching what the authenticated user provided.
    //    (Workspace membership is enforced upstream in the gateway; the search
    //     service enforces it at the ES filter level to be defence-in-depth.)

    // 3. Build ES query
    const filters: object[] = [
      { term: { workspaceId } },
    ]
    if (types && types.length > 0) {
      filters.push({ terms: { type: types } })
    }
    if (listId) {
      filters.push({ term: { listId } })
    }

    const esQuery = {
      bool: {
        must: {
          multi_match: {
            query:  q,
            fields: ['title^2', 'description'],   // title boosted 2x
            type:   'best_fields',
            fuzziness: 'AUTO',
          },
        },
        filter: filters,
      },
    }

    // 4. Execute search
    let esResponse: Awaited<ReturnType<Client['search']>>
    try {
      esResponse = await elastic.search({
        index: INDEX,
        from:  (page - 1) * pageSize,
        size:  pageSize,
        body: {
          query: esQuery,
          highlight: {
            fields: {
              title:       { number_of_fragments: 1, fragment_size: 200 },
              description: { number_of_fragments: 1, fragment_size: 200 },
            },
            pre_tags:  [''],
            post_tags: [''],
          },
        },
      })
    } catch {
      throw new AppError(ErrorCode.SEARCH_UNAVAILABLE)
    }

    // 5. Map hits to SearchResult
    const hits = esResponse.hits.hits
    const total = typeof esResponse.hits.total === 'number'
      ? esResponse.hits.total
      : (esResponse.hits.total as { value: number }).value

    const data: SearchResult[] = hits.map((hit) => {
      const src = hit._source as Record<string, unknown>
      const highlights = (hit.highlight ?? {}) as Record<string, string[]>

      // Snippet: prefer ES highlight, fall back to first 200 chars of description
      const snippet: string =
        highlights['description']?.[0] ??
        highlights['title']?.[0] ??
        (typeof src['description'] === 'string'
          ? (src['description'] as string).slice(0, 200)
          : '')

      return {
        id:          String(src['id'] ?? hit._id),
        type:        String(src['type'] ?? 'task'),
        title:       String(src['title'] ?? ''),
        snippet,
        workspaceId: String(src['workspaceId'] ?? ''),
        listId:      src['listId'] != null ? String(src['listId']) : null,
        createdAt:   String(src['createdAt'] ?? ''),
      }
    })

    res.json({ data, total, page, pageSize })
  }
}
```

---

## 8. NATS Subscriptions (search.indexer.ts)

Export a single startup function. Call it from `index.ts` after the ES client
is confirmed healthy (i.e., after `ensureIndex` resolves without error).

### 8.1 Startup (index.ts)

```typescript
// index.ts — after ensureIndex and before app.listen
import { startSearchIndexers } from './search/search.indexer'

const elastic = createElasticClient()
await ensureIndex(elastic)
await startSearchIndexers(elastic)
logger.info({ service: 'search-service' }, 'NATS indexers started')
```

### 8.2 Indexer File (search.indexer.ts)

```typescript
// search/search.indexer.ts
import { subscribe, logger } from '@clickup/sdk'
import {
  TASK_EVENTS,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
} from '@clickup/contracts'
import { Client } from '@elastic/elasticsearch'
import { INDEX } from './elastic.client'

export async function startSearchIndexers(elastic: Client): Promise<void> {

  // --- Subscription 1: task.created → index new document ---
  await subscribe(
    TASK_EVENTS.CREATED,
    async (payload: TaskCreatedEvent) => {
      await elastic.index({
        index: INDEX,
        id:    payload.taskId,
        document: {
          id:          payload.taskId,
          type:        'task',
          workspaceId: payload.workspaceId,
          listId:      payload.listId,
          title:       payload.title,
          description: payload.description ?? '',
          status:      payload.status ?? null,
          priority:    payload.priority ?? null,
          assigneeId:  payload.assigneeId ?? null,
          createdBy:   payload.createdBy,
          createdAt:   payload.occurredAt,
          updatedAt:   payload.occurredAt,
          tags:        payload.tags ?? [],
        },
      })
      logger.info({ taskId: payload.taskId }, 'search: indexed task.created')
    },
    { durable: 'search-svc-task-created' },
  )

  // --- Subscription 2: task.updated → partial document update ---
  await subscribe(
    TASK_EVENTS.UPDATED,
    async (payload: TaskUpdatedEvent) => {
      // payload.changes is a partial task object with only changed fields.
      // Always update updatedAt to reflect the event time.
      await elastic.update({
        index: INDEX,
        id:    payload.taskId,
        doc: {
          ...payload.changes,
          updatedAt: payload.occurredAt,
        },
      })
      logger.info({ taskId: payload.taskId }, 'search: updated task.updated')
    },
    { durable: 'search-svc-task-updated' },
  )

  // --- Subscription 3: task.deleted → remove document ---
  await subscribe(
    TASK_EVENTS.DELETED,
    async (payload: TaskDeletedEvent) => {
      try {
        await elastic.delete({
          index: INDEX,
          id:    payload.taskId,
        })
        logger.info({ taskId: payload.taskId }, 'search: removed task.deleted')
      } catch (err: unknown) {
        // Ignore 404 — document may never have been indexed or was already removed
        const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode
        if (status !== 404) throw err
        logger.debug({ taskId: payload.taskId }, 'search: task.deleted — doc not found, skipping')
      }
    },
    { durable: 'search-svc-task-deleted' },
  )
}
```

### 8.3 Subscription Summary

| NATS Subject | Durable Consumer Name | ES Operation | Notes |
|---|---|---|---|
| `TASK_EVENTS.CREATED` | `search-svc-task-created` | `elastic.index` | Full document; `description` defaults to `''` if absent |
| `TASK_EVENTS.UPDATED` | `search-svc-task-updated` | `elastic.update` | Partial update; always sets `updatedAt` |
| `TASK_EVENTS.DELETED` | `search-svc-task-deleted` | `elastic.delete` | 404 is silently ignored |

---

## 9. Health Check

The template's health endpoint must verify the ES connection. In `index.ts`,
after calling `ensureIndex`, store a reference to `elastic` and extend the
health check handler:

```typescript
// Extend the /health handler in index.ts
let esStatus: 'ok' | 'error' = 'ok'
try {
  await elastic.ping()
  esStatus = 'ok'
} catch {
  esStatus = 'error'
}

// Health response shape (postgres removed — no DB in this service):
res.json({
  status: esStatus === 'ok' ? 'ok' : 'degraded',
  checks: {
    elasticsearch: esStatus,
    nats:          natsStatus,   // provided by template
  },
})
```

`GET /health` must return `HTTP 200` with `elasticsearch: "ok"` when ES is
reachable. If ES is unreachable, return `HTTP 200` with `status: "degraded"` and
`elasticsearch: "error"` — do NOT return 5xx from the health endpoint itself.

---

## 10. Routes Registration

```typescript
// routes.ts
import { Router }       from 'express'
import { requireAuth, asyncHandler } from '@clickup/sdk'
import { Client }       from '@elastic/elasticsearch'
import { searchHandler } from './search/search.handler'

export function createRouter(elastic: Client): Router {
  const router = Router()

  router.get(
    '/api/v1/search',
    requireAuth,
    asyncHandler(searchHandler(elastic)),
  )

  return router
}
```

Pass `elastic` (the `Client` instance, already initialised and health-checked)
from `index.ts` into `createRouter`.

---

## 11. .env.example

```dotenv
SERVICE_NAME=search-service
PORT=3008
ELASTICSEARCH_URL=http://localhost:9200
NATS_URL=nats://localhost:4222
JWT_SECRET=change-me-in-production
LOG_LEVEL=info
```

There is NO `DATABASE_URL` entry. This service has zero PostgreSQL dependency.

---

## 12. package.json

Start from `services/_template/package.json` and make exactly these changes:
- `"name"` → `"@clickup/search-service"`
- Add to `"dependencies"`: `"@elastic/elasticsearch": "^8.0.0"`
- Ensure `"@clickup/contracts"` and `"@clickup/sdk"` are listed in `"dependencies"`

Do NOT add `pg`, `postgres`, or any other database driver.

---

## 13. Mandatory Tests

### 13.1 Unit Tests — Handler (tests/unit/search.handler.test.ts)

Use a fully mocked `elastic` client (jest mock or `vi.fn()`). Do NOT spin up ES.

```
□ Returns 200 with data/total/page/pageSize on successful search
□ Always includes workspaceId as a filter term (security: never omit)
□ Applies `types` filter when provided
□ Applies `listId` filter when provided
□ Does NOT apply types filter when types is undefined
□ Does NOT apply listId filter when listId is undefined
□ Uses (page - 1) * pageSize as ES `from` offset
□ Throws SEARCH_INVALID_QUERY when q is missing
□ Throws SEARCH_INVALID_QUERY when q exceeds 200 characters
□ Throws SEARCH_INVALID_QUERY when workspaceId is not a valid UUID
□ Throws SEARCH_INVALID_QUERY when pageSize exceeds 50
□ Throws SEARCH_UNAVAILABLE when ES client.search() throws
□ Snippet: uses ES highlight when available
□ Snippet: falls back to first 200 chars of description when no highlight
□ Snippet: returns empty string when neither highlight nor description present
□ Maps ES hits to SearchResult shape: id, type, title, snippet, workspaceId, listId, createdAt
□ listId is null in SearchResult when source document has no listId
□ Handles ES total as number (legacy ES response format)
□ Handles ES total as { value: number } object (ES 7+ response format)
```

### 13.2 Unit Tests — Indexer (tests/unit/search.indexer.test.ts)

Use a fully mocked `elastic` client.

```
□ task.created: calls elastic.index with id=taskId and type='task'
□ task.created: document includes workspaceId, listId, title, createdBy, createdAt
□ task.created: description defaults to '' when payload.description is undefined
□ task.created: tags defaults to [] when payload.tags is undefined
□ task.updated: calls elastic.update with id=taskId and doc={...changes, updatedAt}
□ task.updated: always sets updatedAt to payload.occurredAt regardless of changes content
□ task.deleted: calls elastic.delete with id=taskId
□ task.deleted: silently ignores 404 error from elastic.delete (doc already gone)
□ task.deleted: re-throws non-404 errors from elastic.delete
```

### 13.3 Integration Tests (tests/integration/search.handler.test.ts)

Requires a live ElasticSearch at `ELASTICSEARCH_URL` (provided by docker-compose).
Create a unique index name per test run to avoid cross-test pollution:
```typescript
const TEST_INDEX = `clickup_tasks_test_${Date.now()}`
```
Delete the index in `afterAll`.

```
□ GET /api/v1/search?q=foo&workspaceId=<uuid> → 200 { data: [], total: 0 } when index empty
□ GET /api/v1/search?q=login&workspaceId=<uuid> → returns task with 'login' in title
□ GET /api/v1/search?q=login&workspaceId=<uuid> → does NOT return task from a different workspaceId
□ GET /api/v1/search?q=foo&workspaceId=<uuid>&types=task → returns only type='task' docs
□ GET /api/v1/search?q=foo&workspaceId=<uuid>&listId=<uuid> → filters by listId
□ GET /api/v1/search?q=foo&workspaceId=<uuid>&page=2&pageSize=1 → returns second result
□ GET /api/v1/search without auth → 401
□ GET /api/v1/search?workspaceId=<uuid> (missing q) → 400 SEARCH_INVALID_QUERY
□ GET /api/v1/search?q=foo&workspaceId=not-a-uuid → 400 SEARCH_INVALID_QUERY
□ GET /api/v1/search?q=foo&workspaceId=<uuid>&pageSize=999 → 400 SEARCH_INVALID_QUERY
□ GET /health → 200 { status: 'ok', checks: { elasticsearch: 'ok', nats: 'ok' } }
```

---

## 14. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass (unit + integration)
□ GET /health returns 200 with elasticsearch "ok" and nats "ok"
□ NATS indexers start on service boot (logged at INFO level)
□ GET /api/v1/search returns results for a task indexed by the task.created subscriber
□ GET /api/v1/search always filters by workspaceId — verified by integration test
□ No console.log anywhere in src/ — use logger from @clickup/sdk only
□ No raw Error thrown anywhere in src/ — only AppError(ErrorCode.X)
□ No SQL, no pg import, no DATABASE_URL usage anywhere in the service
□ packages/contracts not modified
□ packages/sdk not modified
□ .env file not committed (only .env.example)
□ PR description: "Search Service — full-text search over ElasticSearch, indexed via NATS events"
```

---

## 15. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk
✗ Do NOT create DB tables, run migrations, or import pg
✗ Do NOT add DATABASE_URL to .env.example or any config
✗ Do NOT expose write endpoints — all ES writes come from NATS only
✗ Do NOT return results from workspaceId other than the one in the query param
✗ Do NOT call any other microservice over HTTP (no service-to-service calls)
✗ Do NOT publish NATS events — search-service is a pure consumer
✗ Do NOT import SearchQuerySchema from @clickup/contracts — define it inline
✗ Do NOT use console.log — logger from @clickup/sdk only
✗ Do NOT throw raw Error — AppError(ErrorCode.X) only
✗ Do NOT implement comment indexing in this wave — only TASK_EVENTS subscriptions
✗ Do NOT commit .env
```
