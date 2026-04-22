# Work Order — Docs Service: Core CRUD
**Wave:** 2
**Session ID:** WO-022
**Depends on:** WO-001 (identity-service merged), WO-009 (test-helpers merged)
**Branch name:** `wave2/docs-core`
**Estimated time:** 2 hours

---

## 1. Mission

Build the Docs Service: a standalone microservice that owns document (wiki page)
storage for a workspace. It handles flat and nested documents, public sharing via
`is_public` flag, and full soft-delete cascades for nested pages using a materialized
path column.

This WO does NOT implement real-time collaborative editing (that is WO-023, which
will layer Y.js on top). It does NOT implement doc-level access control beyond
workspace membership (that is WO-024). What it delivers is the complete CRUD
surface that WO-023 and WO-024 both depend on.

Every other service that cares about document activity (notification-service,
search-service, activity-service) subscribes to the NATS events this service
publishes — it never calls them directly.

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → docs-service (:3004)
      → PostgreSQL (table: docs)
      → identity-service (:3001) HTTP: verify workspace membership
      ↘ NATS publishes:
          doc.created
          doc.updated
          doc.deleted   (payload includes all soft-deleted child IDs)
      ← Does NOT subscribe to any events in Wave 2

Downstream consumers (subscribe, never called directly):
  notification-service  →  doc.created, doc.updated
  search-service        →  doc.created, doc.updated, doc.deleted
  activity-service      →  doc.created, doc.updated, doc.deleted

NOT in this WO:
  Y.js / CRDTs / realtime collab  →  WO-023
  Doc ACL / per-user permissions  →  WO-024
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

No additional npm dependencies beyond what `_template` already installs.

---

## 4. Files to Create

```
services/docs-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=docs-service, PORT=3004]
│   ├── routes.ts                       [register all doc routes]
│   └── docs/
│       ├── docs.handler.ts             [HTTP handlers — no SQL, no business logic]
│       ├── docs.service.ts             [business logic, path computation, event publishing]
│       ├── docs.repository.ts          [all DB queries — no business logic here]
│       └── docs.queries.ts             [SQL string constants — imported only by repository]
├── tests/
│   ├── unit/
│   │   └── docs.service.test.ts        [mock repository, test path logic in isolation]
│   └── integration/
│       └── docs.handler.test.ts        [real DB via withRollback(), test HTTP layer]
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
  // Input types
  CreateDocInput,
  UpdateDocInput,
  DocListQuery,
  // Zod schemas (for validate() — never write manual validation)
  CreateDocSchema,
  UpdateDocSchema,
  DocListQuerySchema,
  // Error codes
  ErrorCode,
  // NATS event names + payload types
  DOC_EVENTS,
  DocCreatedEvent,
  DocUpdatedEvent,
  DocDeletedEvent,
} from '@clickup/contracts'

// From @clickup/sdk  (READ ONLY — never modify this package)
import {
  requireAuth,        // express middleware — verifies JWT, attaches req.user
  AppError,           // ONLY way to throw domain errors
  asyncHandler,       // wraps async route handlers, forwards errors to Express
  validate,           // validate(Schema, data) — never write manual Zod calls
  tier2Get,           // Redis cache read  (TTL tier 2: 60 s)
  tier2Set,           // Redis cache write
  tier2Del,           // Redis cache invalidate
  CacheKeys,          // canonical key builders — never construct ad-hoc strings
  publish,            // NATS publish — always call AFTER DB write, never inside tx
  logger,             // Pino — never use console.log
  createServiceClient, // typed HTTP client for inter-service calls
} from '@clickup/sdk'
```

---

## 6. Database Schema (Already Exists — DO NOT Create)

```sql
-- This migration already ran. DO NOT re-create or ALTER these tables.
CREATE TABLE docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled',
  content       JSONB NOT NULL DEFAULT '{}',
  parent_id     UUID REFERENCES docs(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,  -- materialized path: /{workspace_id}/{doc_id}/
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_docs_workspace ON docs (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_path ON docs USING BTREE (path text_pattern_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_parent ON docs (parent_id) WHERE deleted_at IS NULL;
```

**Materialized path rules:**
- Root doc (no parent): `path = /{workspace_id}/{doc_id}/`
- Nested page under parent: `path = {parent.path}{new_doc_id}/`
- All descendants of a doc: `WHERE path LIKE $parentPath || '%'`
- Do NOT use recursive CTEs — the path index makes LIKE prefix queries fast.

---

## 7. Implementation

### 7.1 SQL Queries (`src/docs/docs.queries.ts`)

```typescript
// src/docs/docs.queries.ts
// All SQL strings live here. This file is imported ONLY by docs.repository.ts.
// No business logic. No parameters built here — parameters are bound in the repository.
// NEVER use recursive CTEs. Use path LIKE for tree traversal.

export const DOCS_QUERIES = {
  /**
   * Insert a new doc row.
   * $1=id, $2=workspace_id, $3=title, $4=content, $5=parent_id,
   * $6=path, $7=is_public, $8=created_by
   */
  INSERT: `
    INSERT INTO docs (id, workspace_id, title, content, parent_id, path, is_public, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,

  /**
   * Fetch a single doc by ID. Excludes soft-deleted rows.
   * $1=id
   */
  FIND_BY_ID: `
    SELECT *
    FROM docs
    WHERE id = $1
      AND deleted_at IS NULL
  `,

  /**
   * List top-level docs in a workspace (parent_id IS NULL),
   * plus a count of their immediate children.
   * $1=workspace_id
   */
  LIST_TOP_LEVEL: `
    SELECT
      d.*,
      COUNT(c.id)::int AS child_count
    FROM docs d
    LEFT JOIN docs c
      ON c.parent_id = d.id
      AND c.deleted_at IS NULL
    WHERE d.workspace_id = $1
      AND d.parent_id IS NULL
      AND d.deleted_at IS NULL
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `,

  /**
   * List immediate children of a doc (one level only).
   * $1=parent_id
   */
  LIST_CHILDREN: `
    SELECT *
    FROM docs
    WHERE parent_id = $1
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `,

  /**
   * List all descendants of a doc at any depth using materialized path.
   * $1=path prefix (e.g. '/{workspace_id}/{doc_id}/')
   * Uses LIKE prefix — covered by idx_docs_path (text_pattern_ops).
   * NEVER replace with a recursive CTE.
   */
  LIST_DESCENDANTS: `
    SELECT *
    FROM docs
    WHERE path LIKE $1 || '%'
      AND deleted_at IS NULL
    ORDER BY path ASC
  `,

  /**
   * Update mutable fields on a doc. Sets updated_at to NOW().
   * $1=title, $2=content, $3=is_public, $4=id
   */
  UPDATE: `
    UPDATE docs
    SET
      title      = COALESCE($1, title),
      content    = COALESCE($2, content),
      is_public  = COALESCE($3, is_public),
      updated_at = NOW()
    WHERE id = $4
      AND deleted_at IS NULL
    RETURNING *
  `,

  /**
   * Soft-delete a single doc.
   * $1=id
   */
  SOFT_DELETE: `
    UPDATE docs
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
  `,

  /**
   * Soft-delete all descendants of a doc using path prefix.
   * Must be called IN THE SAME TRANSACTION as SOFT_DELETE.
   * $1=path prefix (e.g. '/{workspace_id}/{doc_id}/')
   * Returns all IDs that were soft-deleted (for event payload).
   */
  SOFT_DELETE_DESCENDANTS: `
    UPDATE docs
    SET deleted_at = NOW()
    WHERE path LIKE $1 || '%'
      AND deleted_at IS NULL
    RETURNING id
  `,
} as const
```

### 7.2 Repository (`src/docs/docs.repository.ts`)

```typescript
// src/docs/docs.repository.ts
// All DB access for the docs domain.
// Rules:
//   - SQL lives in docs.queries.ts — never write inline SQL here
//   - No business logic — only data access
//   - Transactions are explicit (passed in as a parameter) — never open
//     a transaction inside the repository

import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { Doc } from '@clickup/contracts'
import { logger } from '@clickup/sdk'
import { DOCS_QUERIES } from './docs.queries'

export interface DocRow extends Doc {
  child_count?: number  // populated by LIST_TOP_LEVEL only
}

export class DocsRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<DocRow | null> {
    const result = await this.db.query<DocRow>(DOCS_QUERIES.FIND_BY_ID, [id])
    return result.rows[0] ?? null
  }

  async listTopLevel(workspaceId: string): Promise<DocRow[]> {
    const result = await this.db.query<DocRow>(
      DOCS_QUERIES.LIST_TOP_LEVEL,
      [workspaceId],
    )
    return result.rows
  }

  async listChildren(parentId: string): Promise<DocRow[]> {
    const result = await this.db.query<DocRow>(
      DOCS_QUERIES.LIST_CHILDREN,
      [parentId],
    )
    return result.rows
  }

  async listDescendants(parentPath: string): Promise<DocRow[]> {
    // parentPath must already include the trailing slash, e.g. /ws-id/doc-id/
    const result = await this.db.query<DocRow>(
      DOCS_QUERIES.LIST_DESCENDANTS,
      [parentPath],
    )
    return result.rows
  }

  /**
   * Inserts a new doc. Computes the materialized path before inserting.
   *
   * @param tx - Optional PoolClient for transaction context. Pass when this
   *             insert must be atomic with other writes.
   */
  async create(
    input: {
      workspaceId: string
      title: string
      content: Record<string, unknown>
      parentId: string | null
      parentPath: string | null   // caller resolves parent path before calling
      isPublic: boolean
      createdBy: string
    },
    tx?: PoolClient,
  ): Promise<DocRow> {
    const id = randomUUID()
    // Path: if parent exists, append to parent path; else root path
    const path = input.parentPath
      ? `${input.parentPath}${id}/`
      : `/${input.workspaceId}/${id}/`

    const runner = tx ?? this.db
    const result = await runner.query<DocRow>(DOCS_QUERIES.INSERT, [
      id,
      input.workspaceId,
      input.title,
      JSON.stringify(input.content),
      input.parentId,
      path,
      input.isPublic,
      input.createdBy,
    ])
    return result.rows[0]!
  }

  async update(
    id: string,
    patch: { title?: string; content?: Record<string, unknown>; isPublic?: boolean },
  ): Promise<DocRow | null> {
    const result = await this.db.query<DocRow>(DOCS_QUERIES.UPDATE, [
      patch.title ?? null,
      patch.content ? JSON.stringify(patch.content) : null,
      patch.isPublic ?? null,
      id,
    ])
    return result.rows[0] ?? null
  }

  /**
   * Soft-deletes a doc AND all its descendants atomically.
   * Returns the IDs of every row that was deleted (root + children).
   * Uses a transaction internally — this is the one case where the repository
   * owns the transaction because the two DELETEs must always be atomic.
   */
  async softDeleteWithDescendants(
    id: string,
    docPath: string,
  ): Promise<string[]> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // 1. Soft-delete the root doc itself
      const rootResult = await client.query<{ id: string }>(
        DOCS_QUERIES.SOFT_DELETE,
        [id],
      )
      if (rootResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return []   // Already deleted or not found — caller handles this
      }

      // 2. Soft-delete all descendants (path LIKE prefix)
      const childResult = await client.query<{ id: string }>(
        DOCS_QUERIES.SOFT_DELETE_DESCENDANTS,
        [docPath],
      )

      await client.query('COMMIT')

      const allDeletedIds = [
        rootResult.rows[0]!.id,
        ...childResult.rows.map(r => r.id),
      ]
      logger.info({ docId: id, deletedCount: allDeletedIds.length }, 'doc soft-deleted with descendants')
      return allDeletedIds
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
```

### 7.3 Service (`src/docs/docs.service.ts`)

```typescript
// src/docs/docs.service.ts
// Business logic layer.
// Rules:
//   - No SQL — delegate everything to DocsRepository
//   - Publish NATS events AFTER DB writes, NEVER inside a transaction
//   - Use AppError(ErrorCode.X) for all domain errors
//   - Verify workspace membership via identity-service before any write
//   - Invalidate Redis cache on every mutation

import { AppError, ErrorCode, publish, tier2Get, tier2Set, tier2Del, CacheKeys, logger, createServiceClient } from '@clickup/sdk'
import { Doc, CreateDocInput, UpdateDocInput, DOC_EVENTS, DocCreatedEvent, DocUpdatedEvent, DocDeletedEvent } from '@clickup/contracts'
import { DocsRepository } from './docs.repository'

export class DocsService {
  private readonly identityClient = createServiceClient(
    process.env['IDENTITY_SERVICE_URL'] ?? 'http://localhost:3001',
  )

  constructor(private readonly repo: DocsRepository) {}

  // ---------------------------------------------------------------------------
  // Create a doc (root or nested page)
  // ---------------------------------------------------------------------------

  async createDoc(
    workspaceId: string,
    input: CreateDocInput,
    requestingUserId: string,
  ): Promise<Doc> {
    // 1. Verify requesting user is a member of the workspace
    await this.assertWorkspaceMember(workspaceId, requestingUserId)

    // 2. If creating a nested page, load parent and verify it belongs to the same workspace
    let parentPath: string | null = null
    if (input.parent_id) {
      const parent = await this.repo.findById(input.parent_id)
      if (!parent) {
        throw new AppError(ErrorCode.DOC_NOT_FOUND,
          `Parent doc ${input.parent_id} not found.`)
      }
      if (parent.workspace_id !== workspaceId) {
        throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
          'Parent doc belongs to a different workspace.')
      }
      parentPath = parent.path
    }

    // 3. Insert
    const doc = await this.repo.create({
      workspaceId,
      title: input.title ?? 'Untitled',
      content: input.content ?? {},
      parentId: input.parent_id ?? null,
      parentPath,
      isPublic: input.is_public ?? false,
      createdBy: requestingUserId,
    })

    // 4. Invalidate workspace doc list cache
    await tier2Del(CacheKeys.docList(workspaceId))

    // 5. Publish event AFTER DB write — never inside transaction
    const event: DocCreatedEvent = {
      docId: doc.id,
      workspaceId,
      title: doc.title,
      parentId: doc.parent_id ?? null,
      createdBy: requestingUserId,
      isPublic: doc.is_public,
    }
    await publish(DOC_EVENTS.CREATED, event)

    logger.info({ docId: doc.id, workspaceId, parentId: doc.parent_id }, 'doc created')
    return doc
  }

  // ---------------------------------------------------------------------------
  // List top-level docs in a workspace
  // ---------------------------------------------------------------------------

  async listDocs(workspaceId: string, requestingUserId: string): Promise<Doc[]> {
    await this.assertWorkspaceMember(workspaceId, requestingUserId)

    const cacheKey = CacheKeys.docList(workspaceId)
    const cached = await tier2Get<Doc[]>(cacheKey)
    if (cached) return cached

    const docs = await this.repo.listTopLevel(workspaceId)
    await tier2Set(cacheKey, docs)
    return docs
  }

  // ---------------------------------------------------------------------------
  // Get a single doc with its immediate children
  // ---------------------------------------------------------------------------

  async getDoc(
    docId: string,
    requestingUserId: string,
  ): Promise<Doc & { children: Doc[] }> {
    const doc = await this.repo.findById(docId)
    if (!doc) {
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    // Public docs are readable by anyone (no auth check).
    // Private docs require workspace membership.
    if (!doc.is_public) {
      await this.assertWorkspaceMember(doc.workspace_id, requestingUserId)
    }

    const children = await this.repo.listChildren(docId)
    return { ...doc, children }
  }

  // ---------------------------------------------------------------------------
  // Update a doc (title, content, is_public)
  // ---------------------------------------------------------------------------

  async updateDoc(
    docId: string,
    input: UpdateDocInput,
    requestingUserId: string,
  ): Promise<Doc> {
    const existing = await this.repo.findById(docId)
    if (!existing) {
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    await this.assertWorkspaceMember(existing.workspace_id, requestingUserId)

    const updated = await this.repo.update(docId, {
      title: input.title,
      content: input.content,
      isPublic: input.is_public,
    })

    if (!updated) {
      // Raced to deletion between the findById and the update
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    // Invalidate caches
    await Promise.all([
      tier2Del(CacheKeys.doc(docId)),
      tier2Del(CacheKeys.docList(existing.workspace_id)),
    ])

    // Publish event AFTER DB write
    const event: DocUpdatedEvent = {
      docId: updated.id,
      workspaceId: updated.workspace_id,
      title: updated.title,
      isPublic: updated.is_public,
      updatedBy: requestingUserId,
    }
    await publish(DOC_EVENTS.UPDATED, event)

    logger.info({ docId, updatedBy: requestingUserId }, 'doc updated')
    return updated
  }

  // ---------------------------------------------------------------------------
  // Soft-delete a doc and all its descendants
  // ---------------------------------------------------------------------------

  async deleteDoc(docId: string, requestingUserId: string): Promise<void> {
    const doc = await this.repo.findById(docId)
    if (!doc) {
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    await this.assertWorkspaceMember(doc.workspace_id, requestingUserId)

    // Soft-delete root + all descendants in one transaction (inside repository)
    const allDeletedIds = await this.repo.softDeleteWithDescendants(docId, doc.path)

    if (allDeletedIds.length === 0) {
      // Race condition: already deleted
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    // Invalidate caches for root doc and workspace list
    await Promise.all([
      tier2Del(CacheKeys.doc(docId)),
      tier2Del(CacheKeys.docList(doc.workspace_id)),
    ])

    // Publish event AFTER DB write — payload includes all deleted child IDs
    const event: DocDeletedEvent = {
      docId,
      workspaceId: doc.workspace_id,
      deletedIds: allDeletedIds,
      deletedBy: requestingUserId,
    }
    await publish(DOC_EVENTS.DELETED, event)

    logger.info(
      { docId, workspaceId: doc.workspace_id, deletedCount: allDeletedIds.length },
      'doc soft-deleted with descendants',
    )
  }

  // ---------------------------------------------------------------------------
  // List all nested pages (all descendants at any depth)
  // ---------------------------------------------------------------------------

  async listPages(docId: string, requestingUserId: string): Promise<Doc[]> {
    const doc = await this.repo.findById(docId)
    if (!doc) {
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Doc ${docId} not found.`)
    }

    if (!doc.is_public) {
      await this.assertWorkspaceMember(doc.workspace_id, requestingUserId)
    }

    // path LIKE prefix query — never recursive CTE
    return this.repo.listDescendants(doc.path)
  }

  // ---------------------------------------------------------------------------
  // Create a nested page under an existing doc
  // ---------------------------------------------------------------------------

  async createPage(
    parentDocId: string,
    input: CreateDocInput,
    requestingUserId: string,
  ): Promise<Doc> {
    const parent = await this.repo.findById(parentDocId)
    if (!parent) {
      throw new AppError(ErrorCode.DOC_NOT_FOUND, `Parent doc ${parentDocId} not found.`)
    }

    await this.assertWorkspaceMember(parent.workspace_id, requestingUserId)

    const doc = await this.repo.create({
      workspaceId: parent.workspace_id,
      title: input.title ?? 'Untitled',
      content: input.content ?? {},
      parentId: parentDocId,
      parentPath: parent.path,
      isPublic: input.is_public ?? false,
      createdBy: requestingUserId,
    })

    await tier2Del(CacheKeys.docList(parent.workspace_id))

    const event: DocCreatedEvent = {
      docId: doc.id,
      workspaceId: parent.workspace_id,
      title: doc.title,
      parentId: parentDocId,
      createdBy: requestingUserId,
      isPublic: doc.is_public,
    }
    await publish(DOC_EVENTS.CREATED, event)

    logger.info({ docId: doc.id, parentDocId, workspaceId: parent.workspace_id }, 'nested page created')
    return doc
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Calls identity-service to verify the user is a member of the workspace.
   * Throws AUTH_INSUFFICIENT_PERMISSION if not.
   * This is the ONLY place in the service layer where identity-service is called.
   */
  private async assertWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.identityClient.get(
        `/internal/workspaces/${workspaceId}/members/${userId}`,
      )
    } catch {
      throw new AppError(
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
        'You are not a member of this workspace.',
      )
    }
  }
}
```

### 7.4 Handler (`src/docs/docs.handler.ts`)

```typescript
// src/docs/docs.handler.ts
// HTTP layer only. No SQL, no business logic, no NATS calls.
// Every handler:
//   1. Calls validate() for request body/query
//   2. Calls service method
//   3. Returns the result with the correct HTTP status code
// Errors bubble up to the global error handler via asyncHandler.

import { Router } from 'express'
import { asyncHandler, requireAuth, validate } from '@clickup/sdk'
import {
  CreateDocSchema,
  UpdateDocSchema,
  DocListQuerySchema,
} from '@clickup/contracts'
import { DocsService } from './docs.service'

export function createDocsRouter(service: DocsService): Router {
  const router = Router()

  // ---------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/docs
  // Create a doc (optionally nested via body.parent_id)
  // ---------------------------------------------------------------------------
  router.post(
    '/workspaces/:workspaceId/docs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      const input = validate(CreateDocSchema, req.body)

      const doc = await service.createDoc(workspaceId!, input, req.user!.id)
      res.status(201).json({ data: doc })
    }),
  )

  // ---------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/docs
  // List top-level docs with immediate child counts
  // ---------------------------------------------------------------------------
  router.get(
    '/workspaces/:workspaceId/docs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      // Validate query params even if currently unused — future-proofing
      validate(DocListQuerySchema, req.query)

      const docs = await service.listDocs(workspaceId!, req.user!.id)
      res.json({ data: docs })
    }),
  )

  // ---------------------------------------------------------------------------
  // GET /docs/:docId
  // Get a single doc + its immediate children list
  // ---------------------------------------------------------------------------
  router.get(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { docId } = req.params
      const doc = await service.getDoc(docId!, req.user!.id)
      res.json({ data: doc })
    }),
  )

  // ---------------------------------------------------------------------------
  // PATCH /docs/:docId
  // Update title, content, or is_public
  // ---------------------------------------------------------------------------
  router.patch(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { docId } = req.params
      const input = validate(UpdateDocSchema, req.body)

      const doc = await service.updateDoc(docId!, input, req.user!.id)
      res.json({ data: doc })
    }),
  )

  // ---------------------------------------------------------------------------
  // DELETE /docs/:docId
  // Soft-delete doc and all descendants
  // ---------------------------------------------------------------------------
  router.delete(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { docId } = req.params
      await service.deleteDoc(docId!, req.user!.id)
      res.status(204).send()
    }),
  )

  // ---------------------------------------------------------------------------
  // GET /docs/:docId/pages
  // List all nested pages (descendants at any depth) via materialized path
  // ---------------------------------------------------------------------------
  router.get(
    '/docs/:docId/pages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { docId } = req.params
      const pages = await service.listPages(docId!, req.user!.id)
      res.json({ data: pages })
    }),
  )

  // ---------------------------------------------------------------------------
  // POST /docs/:docId/pages
  // Create a nested page directly under this doc
  // ---------------------------------------------------------------------------
  router.post(
    '/docs/:docId/pages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { docId } = req.params
      const input = validate(CreateDocSchema, req.body)

      const page = await service.createPage(docId!, input, req.user!.id)
      res.status(201).json({ data: page })
    }),
  )

  return router
}
```

### 7.5 Routes (`src/routes.ts`)

```typescript
// src/routes.ts
// Wires the docs router into the top-level Express app.
// The health route is handled by index.ts (from _template).

import { Router } from 'express'
import { Pool } from 'pg'
import { DocsRepository } from './docs/docs.repository'
import { DocsService } from './docs/docs.service'
import { createDocsRouter } from './docs/docs.handler'

export function createRoutes(db: Pool): Router {
  const router = Router()

  const repo = new DocsService(new DocsRepository(db))
  // Note: DocsService constructor takes DocsRepository, not DocsService.
  // Corrected wiring:
  const repository = new DocsRepository(db)
  const service = new DocsService(repository)

  router.use('/api/v1', createDocsRouter(service))

  return router
}
```

> **NOTE TO JULES:** The comment block above shows the intent — the actual
> `createRoutes` should instantiate `DocsRepository` first, then pass it to
> `DocsService`. Implement it as the corrected version (last 3 lines).

### 7.6 .env.example

```
SERVICE_NAME=docs-service
PORT=3004
LOG_LEVEL=info

# PostgreSQL
DATABASE_URL=postgres://clickup:clickup@localhost:5432/clickup

# Redis (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Identity service (for workspace membership checks)
IDENTITY_SERVICE_URL=http://localhost:3001

# NATS
NATS_URL=nats://localhost:4222

# JWT (same secret across all services)
JWT_SECRET=change-me-in-production
```

---

## 8. Materialized Path: Worked Examples

These examples must match exactly what the implementation produces. Jules should
use these as the ground truth when writing tests.

```
Scenario A: Root doc created in workspace w-1
  workspace_id = "w-1"
  new doc id   = "d-1"
  path         = "/w-1/d-1/"

Scenario B: Nested page under d-1
  parent path  = "/w-1/d-1/"
  new doc id   = "d-2"
  path         = "/w-1/d-1/d-2/"

Scenario C: Page nested under d-2 (depth 3)
  parent path  = "/w-1/d-1/d-2/"
  new doc id   = "d-3"
  path         = "/w-1/d-1/d-2/d-3/"

Scenario D: Fetch all descendants of d-1
  SQL: WHERE path LIKE '/w-1/d-1/' || '%'
  Matches: /w-1/d-1/d-2/   ✓
           /w-1/d-1/d-2/d-3/  ✓
  Does NOT match: /w-1/d-other/  ✓ (correct exclusion)

Scenario E: Delete d-1 (cascades to d-2, d-3)
  SOFT_DELETE          WHERE id = 'd-1'          → returns ['d-1']
  SOFT_DELETE_DESCENDANTS WHERE path LIKE '/w-1/d-1/%'  → returns ['d-2', 'd-3']
  event.deletedIds = ['d-1', 'd-2', 'd-3']
```

---

## 9. NATS Events Published

```typescript
// doc.created — published after INSERT
interface DocCreatedEvent {
  docId: string
  workspaceId: string
  title: string
  parentId: string | null   // null for root docs
  createdBy: string         // user ID
  isPublic: boolean
}

// doc.updated — published after UPDATE
interface DocUpdatedEvent {
  docId: string
  workspaceId: string
  title: string
  isPublic: boolean
  updatedBy: string
}

// doc.deleted — published after soft-delete
// IMPORTANT: deletedIds includes the root doc AND all descendant IDs.
// Consumers (search-service, notification-service) must handle bulk removal.
interface DocDeletedEvent {
  docId: string             // the root doc that was explicitly deleted
  workspaceId: string
  deletedIds: string[]      // root + all descendants that were soft-deleted
  deletedBy: string
}
```

**Rules:**
- Publish AFTER the DB write completes — never inside a transaction
- If the NATS publish fails, log the error but do NOT roll back the DB write
  (eventual consistency — the event can be replayed via the outbox pattern in Wave 3)

---

## 10. Caching Strategy

| Cache key                         | Set on              | Invalidated on             | TTL    |
|-----------------------------------|---------------------|----------------------------|--------|
| `CacheKeys.doc(docId)`            | GET /docs/:docId    | PATCH, DELETE              | 60 s   |
| `CacheKeys.docList(workspaceId)`  | GET /workspaces/*/docs | POST, PATCH, DELETE     | 60 s   |

- Use `tier2Get` / `tier2Set` / `tier2Del` from `@clickup/sdk` — never raw Redis
- Cache stores the full serialized response object (array or single doc)
- Do NOT cache `/docs/:docId/pages` — descendant lists change frequently
- Public docs: still use cache (is_public is already in the cached row)

---

## 11. Error Codes Reference

| Code                           | HTTP | When to throw                                      |
|--------------------------------|------|----------------------------------------------------|
| `ErrorCode.DOC_NOT_FOUND`      | 404  | doc doesn't exist or `deleted_at IS NOT NULL`      |
| `ErrorCode.AUTH_INSUFFICIENT_PERMISSION` | 403 | user not a member of the workspace      |
| `ErrorCode.VALIDATION_ERROR`   | 422  | `validate()` throws (handled automatically by SDK) |

All errors must use `throw new AppError(ErrorCode.X, message)` — never `throw new Error(...)`.

---

## 12. Mandatory Tests

### Unit Tests (`tests/unit/docs.service.test.ts`)

All unit tests mock `DocsRepository` entirely — no DB connection.

```
□ createDoc: throws DOC_NOT_FOUND when parent_id provided but parent row not found
□ createDoc: throws AUTH_INSUFFICIENT_PERMISSION when parent belongs to different workspace
□ createDoc: computes root path as "/{workspaceId}/{newId}/" when no parent_id
□ createDoc: computes nested path as "{parentPath}{newId}/" when parent_id provided
□ createDoc: publishes doc.created event with correct payload after DB insert
□ createDoc: invalidates CacheKeys.docList(workspaceId) after insert
□ createDoc: does NOT publish event if repository.create() throws

□ listDocs: returns cached value from tier2Get when cache is warm
□ listDocs: calls repo.listTopLevel and populates cache when cache is cold
□ listDocs: throws AUTH_INSUFFICIENT_PERMISSION when user not in workspace

□ getDoc: throws DOC_NOT_FOUND when doc does not exist
□ getDoc: returns doc + children for workspace member
□ getDoc: returns doc + children for non-member when doc.is_public = true
□ getDoc: throws AUTH_INSUFFICIENT_PERMISSION for non-member when doc.is_public = false

□ updateDoc: throws DOC_NOT_FOUND when doc not found before update
□ updateDoc: throws DOC_NOT_FOUND when update returns null (race condition)
□ updateDoc: publishes doc.updated with all changed fields after DB write
□ updateDoc: invalidates CacheKeys.doc(docId) and CacheKeys.docList(workspaceId)

□ deleteDoc: throws DOC_NOT_FOUND when doc not found
□ deleteDoc: calls repo.softDeleteWithDescendants with correct path
□ deleteDoc: publishes doc.deleted with full deletedIds array (root + descendants)
□ deleteDoc: throws DOC_NOT_FOUND when softDeleteWithDescendants returns [] (race)
□ deleteDoc: invalidates CacheKeys.doc(docId) and CacheKeys.docList(workspaceId)

□ listPages: throws DOC_NOT_FOUND when parent doc not found
□ listPages: calls repo.listDescendants with the parent doc's path
□ listPages: allows unauthenticated non-member when doc.is_public = true

□ createPage: throws DOC_NOT_FOUND when parent doc not found
□ createPage: computes path as "{parentPath}{newId}/" (inherits parent path)
□ createPage: publishes doc.created with parentId set to the parent doc ID
□ createPage: uses parent.workspace_id (not passed separately) for membership check
```

### Integration Tests (`tests/integration/docs.handler.test.ts`)

Integration tests use `withRollback()` from `@clickup/test-helpers` — the real DB,
real queries, real path computation. Never mock the DB. Mock NATS publish only
(to avoid side effects on other services).

```
□ POST /api/v1/workspaces/:workspaceId/docs
    → 401 when no Authorization header
    → 403 when user is not a workspace member
    → 201 + { data: Doc } with correct path when root doc created
    → 201 + { data: Doc } with correct nested path when parent_id provided
    → 404 when parent_id refers to a non-existent doc
    → 422 when body fails CreateDocSchema validation (e.g. title > 500 chars)

□ GET /api/v1/workspaces/:workspaceId/docs
    → 401 when no Authorization header
    → 403 when user is not a workspace member
    → 200 + array of top-level docs with child_count populated
    → 200 + empty array when workspace has no docs

□ GET /api/v1/docs/:docId
    → 401 when no Authorization header
    → 404 when doc does not exist
    → 403 when doc is private and user is not a workspace member
    → 200 + { data: { ...doc, children: [...] } } for workspace member
    → 200 + { data: doc } for non-member when doc.is_public = true

□ PATCH /api/v1/docs/:docId
    → 401 when no Authorization header
    → 404 when doc does not exist
    → 403 when user is not a workspace member
    → 200 + updated doc when title changed
    → 200 + updated doc when is_public toggled to true
    → 422 when body fails UpdateDocSchema validation

□ DELETE /api/v1/docs/:docId
    → 401 when no Authorization header
    → 404 when doc does not exist
    → 403 when user is not a workspace member
    → 204 when root doc deleted (no descendants)
    → 204 when root doc deleted; verifies descendants also have deleted_at set in DB
    → 404 on second DELETE of same docId (already soft-deleted)

□ GET /api/v1/docs/:docId/pages
    → 401 when no Authorization header
    → 404 when parent doc does not exist
    → 200 + all descendants in path order (depth-first via ORDER BY path ASC)
    → 200 + empty array when doc has no nested pages
    → does NOT include soft-deleted descendants

□ POST /api/v1/docs/:docId/pages
    → 401 when no Authorization header
    → 404 when parent doc does not exist
    → 403 when user is not a workspace member
    → 201 + nested page with path = "{parentPath}{newId}/"
    → 422 when body fails CreateDocSchema validation
```

---

## 13. Definition of Done

```
□ All 7 endpoints implemented and reachable via API Gateway routing
□ Materialized path correctly computed for root docs: "/{workspaceId}/{docId}/"
□ Materialized path correctly computed for nested pages: "{parentPath}{newId}/"
□ Soft-delete cascades to all descendants via path LIKE (NEVER recursive CTE)
□ doc.deleted event payload includes root doc ID + all descendant IDs
□ NATS events published AFTER DB write, never inside transaction
□ Redis cache invalidated on every mutation (POST, PATCH, DELETE)
□ All SQL is in docs.queries.ts — no inline SQL in handler or service
□ No console.log anywhere — only logger from @clickup/sdk
□ AppError(ErrorCode.X) used for all domain errors — no raw Error throws
□ validate(Schema, data) used for all request body validation — no manual Zod
□ Integration tests use withRollback() — DB is never mocked
□ NATS publish is mocked in integration tests (no real events fired)
□ pnpm typecheck passes with zero errors
□ pnpm lint passes with zero warnings
□ All unit tests pass
□ All integration tests pass
□ Coverage ≥ 80% on src/docs/* files
□ GET /health returns 200
```

---

## 14. Constraints

```
✗ Do NOT use recursive CTEs for tree traversal — use path LIKE prefix only
✗ Do NOT implement Y.js or any real-time collaboration — that is WO-023
✗ Do NOT implement doc-level ACL or per-user permissions — that is WO-024
✗ Do NOT modify packages/contracts or packages/sdk — READ ONLY
✗ Do NOT write inline SQL in handler or service files — SQL lives in docs.queries.ts only
✗ Do NOT publish NATS events inside a DB transaction
✗ Do NOT mock the DB in integration tests — use withRollback() from @clickup/test-helpers
✗ Do NOT use console.log — always use logger from @clickup/sdk
✗ Do NOT throw raw Error — always throw AppError(ErrorCode.X, message)
✗ Do NOT write manual Zod validation — always use validate(Schema, data) from @clickup/sdk
✗ Do NOT cache /docs/:docId/pages responses — too volatile
✗ Do NOT allow moving a doc to a different parent in this WO (that is a Wave 3 feature)
```

---

## 15. Allowed Dependencies

No additional npm packages beyond the `_template` baseline. The service uses:

```json
{
  "@clickup/contracts": "workspace:*",
  "@clickup/sdk": "workspace:*",
  "express": "^4.18.0",
  "pg": "^8.11.0"
}
```
