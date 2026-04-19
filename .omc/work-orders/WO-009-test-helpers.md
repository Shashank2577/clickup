# Work Order — Test Helpers Package
**Wave:** 1
**Session ID:** WO-009
**Depends on:** WO-000 (foundation), WO-007 (fixture functions defined there)
**Branch name:** `wave1/test-helpers`
**Estimated time:** 1.5 hours

---

## 1. Mission

Create the `packages/test-helpers` shared package that every integration test
in every service imports. It provides: DB connection setup/teardown, JWT token
factories, supertest request wrappers, and all fixture builder functions.
Without this package, each service would duplicate DB setup boilerplate — this
is the single source of truth for test infrastructure.

---

## 2. Context

```
All integration tests across all services:
  import { createTestUser, createTestWorkspace, ... } from '@clickup/test-helpers'
  import { makeRequest, authHeader, getTestDb } from '@clickup/test-helpers'

This package:
  ← depends on @clickup/contracts (for types)
  ← depends on @clickup/sdk (for signToken to generate test JWTs)
  → used by ALL service integration tests (devDependency only)

WARNING: This package is NEVER imported in production code.
         It is devDependency only in every service.
```

---

## 3. Files to Create

```
packages/test-helpers/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  [barrel — export everything]
    ├── db.ts                     [test DB pool, transaction wrapper]
    ├── auth.ts                   [JWT token factory for tests]
    ├── request.ts                [supertest app factory + request helpers]
    ├── contract-validator.ts     [validateResponse() — moved from WO-008]
    └── fixtures/
        ├── users.fixture.ts      [createTestUser]
        ├── workspaces.fixture.ts [createTestWorkspace, createTestSpace, createTestList]
        └── tasks.fixture.ts      [createTestTask, createTestComment]
```

---

## 4. Dependencies

```json
// packages/test-helpers/package.json
{
  "name": "@clickup/test-helpers",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clickup/contracts": "workspace:*",
    "@clickup/sdk": "workspace:*",
    "pg": "^8.11.0",
    "bcrypt": "^5.1.0",
    "supertest": "^7.0.0"
  },
  "devDependencies": {
    "@pact-foundation/pact": "^12.0.0",
    "@types/bcrypt": "^5.0.2",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.0",
    "typescript": "^5.4.0",
    "zod": "^3.22.0"
  }
}
```

---

## 5. Implementation

### 5.1 DB Setup (`src/db.ts`)

```typescript
// src/db.ts
// Provides a shared Pool for tests + transaction isolation helpers.
// Each test should run inside BEGIN/ROLLBACK for clean state.

import { Pool, PoolClient } from 'pg'

let _pool: Pool | null = null

/**
 * Returns the singleton test DB pool.
 * Reads DATABASE_URL from environment (set in test runner config).
 */
export function getTestDb(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env['DATABASE_URL'] ??
        'postgres://clickup:clickup@localhost:5432/clickup_test',
      max: 5,
    })
  }
  return _pool
}

/**
 * Close the pool — call in global afterAll().
 */
export async function closeTestDb(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}

/**
 * Runs a test function inside a transaction that is always rolled back.
 * This is the primary isolation primitive for integration tests.
 *
 * Usage:
 *   it('creates a user', () => withRollback(async (tx) => {
 *     const user = await createTestUser(tx)
 *     expect(user.id).toBeDefined()
 *   }))
 */
export async function withRollback<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getTestDb()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    return result
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

/**
 * Jest global setup helper — runs migrations on test DB.
 * Call from jest.globalSetup.ts in each service:
 *   export default setupTestDb
 */
export async function setupTestDb(): Promise<void> {
  const pool = getTestDb()

  // Read and run all migration files in order
  const { readdir, readFile } = await import('fs/promises')
  const { join, resolve } = await import('path')

  const migrationsDir = resolve(process.cwd(), '../../infra/migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf-8')
    await pool.query(sql)
  }

  await pool.end()
}
```

### 5.2 Auth Helpers (`src/auth.ts`)

```typescript
// src/auth.ts
// Creates valid JWT tokens for test requests.
// Uses the same signToken from @clickup/sdk — guarantees tokens are valid.

import { signToken } from '@clickup/sdk'

export interface TestAuthContext {
  userId: string
  workspaceId: string
  role?: string
  sessionId?: string
}

/**
 * Generates a valid JWT for the given user/workspace context.
 * The JWT_SECRET env var must match what the service under test uses.
 *
 * Usage:
 *   const token = makeTestToken({ userId: user.id, workspaceId: ws.id })
 *   await request.get('/api/v1/tasks').set('Authorization', `Bearer ${token}`)
 */
export function makeTestToken(ctx: TestAuthContext): string {
  return signToken({
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    role: ctx.role ?? 'member',
    sessionId: ctx.sessionId ?? 'test-session',
  })
}

/**
 * Returns the Authorization header object for supertest.
 *
 * Usage:
 *   await request.get('/api/v1/tasks').set(authHeader(token))
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

/**
 * Returns a full test auth context (token + headers) for a user/workspace.
 */
export function testAuth(ctx: TestAuthContext): {
  token: string
  headers: { Authorization: string }
} {
  const token = makeTestToken(ctx)
  return { token, headers: authHeader(token) }
}
```

### 5.3 Request Helper (`src/request.ts`)

```typescript
// src/request.ts
// Wraps supertest to provide a consistent request factory.
// Services pass their Express app instance to create a typed request client.

import { Express } from 'express'
import supertest from 'supertest'
import { makeTestToken, TestAuthContext } from './auth.js'

/**
 * Creates a supertest request factory bound to an Express app.
 *
 * Usage in a test file:
 *   const api = createTestRequest(app)
 *   const res = await api.get('/api/v1/tasks').asUser({ userId, workspaceId })
 */
export function createTestRequest(app: Express) {
  const agent = supertest(app)

  return {
    get: (path: string) => new AuthedRequest(agent.get(path)),
    post: (path: string) => new AuthedRequest(agent.post(path)),
    patch: (path: string) => new AuthedRequest(agent.patch(path)),
    put: (path: string) => new AuthedRequest(agent.put(path)),
    delete: (path: string) => new AuthedRequest(agent.delete(path)),
  }
}

class AuthedRequest {
  constructor(private req: supertest.Test) {}

  /** Authenticates the request as a given user. */
  asUser(ctx: TestAuthContext): supertest.Test {
    const token = makeTestToken(ctx)
    return this.req
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .set('x-trace-id', 'test-trace-id')
  }

  /** Makes the request without authentication. */
  unauthenticated(): supertest.Test {
    return this.req
      .set('Content-Type', 'application/json')
      .set('x-trace-id', 'test-trace-id')
  }

  /** Sends the raw supertest request (manual auth). */
  raw(): supertest.Test {
    return this.req
  }
}
```

### 5.4 User Fixtures (`src/fixtures/users.fixture.ts`)

```typescript
// src/fixtures/users.fixture.ts
import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'

export interface TestUser {
  id: string
  email: string
  name: string
  password: string   // plaintext — for login tests
}

/**
 * Creates a user in the DB with a bcrypt-hashed password.
 * Uses cost factor 4 (minimum) for test speed — do NOT change for prod code.
 */
export async function createTestUser(
  db: Pool | PoolClient,
  override: Partial<{ email: string; name: string; password: string }> = {}
): Promise<TestUser> {
  const id = randomUUID()
  const password = override.password ?? 'test-password-123'
  const email = override.email ?? `user-${id.slice(0, 8)}@test.com`
  const name = override.name ?? `Test User ${id.slice(0, 8)}`
  const passwordHash = await bcrypt.hash(password, 4)

  await db.query(
    `INSERT INTO users (id, email, name, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [id, email, name, passwordHash]
  )

  return { id, email, name, password }
}
```

### 5.5 Workspace Fixtures (`src/fixtures/workspaces.fixture.ts`)

```typescript
// src/fixtures/workspaces.fixture.ts
import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'

export interface TestWorkspace {
  id: string
  slug: string
  name: string
}

export interface TestSpace {
  id: string
}

export interface TestList {
  id: string
}

export async function createTestWorkspace(
  db: Pool | PoolClient,
  ownerId: string
): Promise<TestWorkspace> {
  const id = randomUUID()
  const slug = `ws-${id.slice(0, 8)}`
  const name = `Workspace ${slug}`

  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, $2, $3, $4)`,
    [id, name, slug, ownerId]
  )
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [id, ownerId]
  )

  return { id, slug, name }
}

export async function createTestSpace(
  db: Pool | PoolClient,
  workspaceId: string,
  createdBy: string
): Promise<TestSpace> {
  const id = randomUUID()

  await db.query(
    `INSERT INTO spaces (id, workspace_id, name, color, created_by)
     VALUES ($1, $2, $3, '#6366f1', $4)`,
    [id, workspaceId, `Space ${id.slice(0, 8)}`, createdBy]
  )

  return { id }
}

export async function createTestList(
  db: Pool | PoolClient,
  spaceId: string,
  createdBy: string
): Promise<TestList> {
  const id = randomUUID()

  await db.query(
    `INSERT INTO lists (id, space_id, name, created_by)
     VALUES ($1, $2, $3, $4)`,
    [id, spaceId, `List ${id.slice(0, 8)}`, createdBy]
  )

  // Seed 3 default statuses (minimal set for test isolation)
  const statuses = [
    { name: 'Todo',        color: '#64748b', group: 'unstarted',  position: 1000, isDefault: true  },
    { name: 'In Progress', color: '#3b82f6', group: 'started',    position: 2000, isDefault: false },
    { name: 'Done',        color: '#22c55e', group: 'completed',  position: 3000, isDefault: false },
  ]
  for (const s of statuses) {
    await db.query(
      `INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [id, s.name, s.color, s.group, s.position, s.isDefault]
    )
  }

  return { id }
}
```

### 5.6 Task Fixtures (`src/fixtures/tasks.fixture.ts`)

```typescript
// src/fixtures/tasks.fixture.ts
import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'crypto'

export interface TestTask {
  id: string
  path: string
  seqId: number
}

export interface TestComment {
  id: string
}

/**
 * Creates a task in the DB with correct materialized path and seq_id.
 * seq_id is inserted atomically via MAX(seq_id)+1 to avoid races in tests.
 */
export async function createTestTask(
  db: Pool | PoolClient,
  listId: string,
  createdBy: string,
  override: Partial<{
    title: string
    priority: string
    parentPath: string   // pass parent.path to create a subtask
  }> = {}
): Promise<TestTask> {
  const id = randomUUID()

  // If no parent, this is a root task under the list
  const path = override.parentPath
    ? `${override.parentPath}${id}/`
    : `/${listId}/${id}/`

  await db.query(
    `INSERT INTO tasks (id, list_id, path, title, status, priority, created_by, version)
     VALUES ($1, $2, $3, $4, 'todo', $5, $6, 0)`,
    [id, listId, path, override.title ?? `Task ${id.slice(0, 8)}`, override.priority ?? 'none', createdBy]
  )

  // Insert sequence with MAX(seq_id)+1 to ensure uniqueness
  const seqResult = await db.query<{ seq_id: number }>(
    `INSERT INTO task_sequences (list_id, seq_id, task_id)
     VALUES ($1, COALESCE((SELECT MAX(seq_id) FROM task_sequences WHERE list_id = $1), 0) + 1, $2)
     RETURNING seq_id`,
    [listId, id]
  )

  const seqId = seqResult.rows[0]!.seq_id
  await db.query(`UPDATE tasks SET seq_id = $1 WHERE id = $2`, [seqId, id])

  return { id, path, seqId }
}

/**
 * Creates a comment on a task.
 */
export async function createTestComment(
  db: Pool | PoolClient,
  taskId: string,
  authorId: string,
  body = 'Test comment body'
): Promise<TestComment> {
  const id = randomUUID()

  await db.query(
    `INSERT INTO comments (id, task_id, body, author_id) VALUES ($1, $2, $3, $4)`,
    [id, taskId, body, authorId]
  )

  return { id }
}
```

### 5.7 Barrel Export (`src/index.ts`)

```typescript
// src/index.ts
// Single import point for all test helpers

// DB
export { getTestDb, closeTestDb, withRollback, setupTestDb } from './db.js'

// Auth
export { makeTestToken, authHeader, testAuth } from './auth.js'
export type { TestAuthContext } from './auth.js'

// Request factory
export { createTestRequest } from './request.js'

// Fixtures
export { createTestUser } from './fixtures/users.fixture.js'
export type { TestUser } from './fixtures/users.fixture.js'

export {
  createTestWorkspace,
  createTestSpace,
  createTestList,
} from './fixtures/workspaces.fixture.js'
export type { TestWorkspace, TestSpace, TestList } from './fixtures/workspaces.fixture.js'

export {
  createTestTask,
  createTestComment,
} from './fixtures/tasks.fixture.js'
export type { TestTask, TestComment } from './fixtures/tasks.fixture.js'

// Contract validator
export { validateResponse, validatePaginatedResponse } from './contract-validator.js'
```

### 5.8 tsconfig.json

```json
// packages/test-helpers/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../contracts" },
    { "path": "../sdk" }
  ]
}
```

---

## 6. How to Use in a Service Integration Test

```typescript
// Example: services/task-service/tests/integration/tasks.handler.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getTestDb, closeTestDb, withRollback,
  createTestUser, createTestWorkspace, createTestSpace, createTestList, createTestTask,
  makeTestToken, authHeader,
  validateResponse,
} from '@clickup/test-helpers'
import { createApp } from '../../src/index.js'  // exports the Express app

const app = createApp()

afterAll(closeTestDb)

describe('GET /api/v1/tasks/:id', () => {
  it('returns task with correct shape', () =>
    withRollback(async (tx) => {
      const user = await createTestUser(tx)
      const ws   = await createTestWorkspace(tx, user.id)
      const sp   = await createTestSpace(tx, ws.id, user.id)
      const list = await createTestList(tx, sp.id, user.id)
      const task = await createTestTask(tx, list.id, user.id)
      const token = makeTestToken({ userId: user.id, workspaceId: ws.id })

      const res = await supertest(app)
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(token))
        .expect(200)

      expect(validateResponse('task', res.body.data)).toBe(true)
      expect(res.body.data.id).toBe(task.id)
    })
  )

  it('returns 401 without token', () =>
    withRollback(async (tx) => {
      const user = await createTestUser(tx)
      const ws   = await createTestWorkspace(tx, user.id)
      const sp   = await createTestSpace(tx, ws.id, user.id)
      const list = await createTestList(tx, sp.id, user.id)
      const task = await createTestTask(tx, list.id, user.id)

      await supertest(app)
        .get(`/api/v1/tasks/${task.id}`)
        .expect(401)
    })
  )
})
```

---

## 7. Mandatory Tests

```
□ createTestUser creates row in users table with bcrypt-hashed password
□ createTestUser generates unique emails (no collision on repeated calls)
□ createTestWorkspace creates workspace + adds owner to workspace_members
□ createTestList creates list + seeds exactly 3 default task statuses
□ createTestTask creates task with correct materialized path (format: /{listId}/{taskId}/)
□ createTestTask inserts into task_sequences + updates tasks.seq_id
□ createTestTask with parentPath creates subtask (path = parent.path + taskId + /)
□ makeTestToken generates a verifiable JWT (verify with sdk/auth verifyToken)
□ withRollback rolls back all changes on function completion
□ withRollback rolls back even if the inner function throws
□ validateResponse('task', validTask) → true
□ validateResponse('task', missingField) → throws with field name in error
```

---

## 8. Definition of Done

```
□ Package builds (pnpm --filter @clickup/test-helpers build)
□ pnpm typecheck passes
□ All mandatory tests pass
□ All fixture functions exported from src/index.ts
□ withRollback isolation is tested (changes do not persist after test)
□ Package is registered in pnpm-workspace.yaml (packages/test-helpers)
□ NEVER imported in production service code (it's a devDependency only)
```

---

## 9. Constraints

```
✗ Do NOT import from other services' src/ directories
✗ Do NOT add this package as a production dependency — devDependency only
✗ Do NOT mock the database in fixture functions — they hit real test DB
✗ Do NOT use bcrypt cost factor > 4 in test fixtures (too slow)
✗ Do NOT seed more than 3 statuses in createTestList (5 is for production seed)
✗ Do NOT export anything that couples to a specific service's business logic
```
