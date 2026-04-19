# Work Order — DB Seed & Fixtures
**Wave:** 1
**Session ID:** WO-007
**Depends on:** WO-000 (migrations must exist)
**Branch name:** `wave1/db-seed`
**Estimated time:** 1 hour

---

## 1. Mission

Create seed scripts and test fixture builders. The seed script sets up a
working development environment with demo data. The fixture builders are
used by all integration tests to create consistent, isolated test data.

---

## 2. Files to Create

```
infra/seeds/
├── seed.ts               [main seed script — run with: pnpm seed]
├── fixtures/
│   ├── users.fixture.ts
│   ├── workspaces.fixture.ts
│   └── tasks.fixture.ts
```

---

## 3. Seed Script

```typescript
// infra/seeds/seed.ts
// Creates demo workspace with realistic data for local development

const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@clickup.oss',
  name: 'Demo User',
  passwordHash: '$2b$12$...',  // bcrypt hash of 'password123'
}

const DEMO_WORKSPACE = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Demo Workspace',
  slug: 'demo',
  ownerId: DEMO_USER.id,
}

// Seed creates:
// 1 user (demo@clickup.oss / password123)
// 1 workspace (demo)
// 2 spaces (Engineering, Marketing)
// 3 lists per space
// 5 default statuses per list
// 10 tasks per list with varied statuses + priorities
// 3 subtasks per task
// 2 comments per task
```

---

## 4. Test Fixtures (used by all integration tests)

```typescript
// packages/test-helpers/src/fixtures.ts
// (This is part of WO-009, but seed fixtures go here)

export async function createTestUser(db: Pool, override = {}) {
  const id = randomUUID()
  const hash = await bcrypt.hash('test-password-123', 4) // low rounds for speed
  await db.query(
    `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
    [id, `user-${id}@test.com`, `Test User ${id.slice(0,8)}`, hash]
  )
  return { id, email: `user-${id}@test.com`, password: 'test-password-123' }
}

export async function createTestWorkspace(db: Pool, ownerId: string) {
  const id = randomUUID()
  const slug = `ws-${id.slice(0,8)}`
  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1,$2,$3,$4)`,
    [id, `Workspace ${slug}`, slug, ownerId]
  )
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')`,
    [id, ownerId]
  )
  return { id, slug }
}

export async function createTestSpace(db: Pool, workspaceId: string, createdBy: string) {
  const id = randomUUID()
  await db.query(
    `INSERT INTO spaces (id, workspace_id, name, color, created_by) VALUES ($1,$2,$3,$4,$5)`,
    [id, workspaceId, `Space ${id.slice(0,8)}`, '#6366f1', createdBy]
  )
  return { id }
}

export async function createTestList(db: Pool, spaceId: string, createdBy: string) {
  const id = randomUUID()
  await db.query(
    `INSERT INTO lists (id, space_id, name, created_by) VALUES ($1,$2,$3,$4)`,
    [id, spaceId, `List ${id.slice(0,8)}`, createdBy]
  )
  // Seed default statuses
  const statuses = [
    { name: 'Todo', color: '#64748b', group: 'unstarted', position: 1000, isDefault: true },
    { name: 'In Progress', color: '#3b82f6', group: 'started', position: 2000, isDefault: false },
    { name: 'Done', color: '#22c55e', group: 'completed', position: 3000, isDefault: false },
  ]
  for (const s of statuses) {
    await db.query(
      `INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6)`,
      [id, s.name, s.color, s.group, s.position, s.isDefault]
    )
  }
  return { id }
}

export async function createTestTask(db: Pool, listId: string, createdBy: string, override = {}) {
  const id = randomUUID()
  const path = `/${listId}/${id}/`
  await db.query(
    `INSERT INTO tasks (id, list_id, path, title, status, priority, created_by, version)
     VALUES ($1,$2,$3,$4,'todo','none',$5,0)`,
    [id, listId, path, `Task ${id.slice(0,8)}`, createdBy]
  )
  // Insert sequence
  const seqResult = await db.query(
    `INSERT INTO task_sequences (list_id, seq_id, task_id)
     VALUES ($1, COALESCE((SELECT MAX(seq_id) FROM task_sequences WHERE list_id=$1), 0) + 1, $2)
     RETURNING seq_id`,
    [listId, id]
  )
  await db.query(`UPDATE tasks SET seq_id=$1 WHERE id=$2`, [seqResult.rows[0].seq_id, id])
  return { id, path }
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
```

---

## 5. Mandatory Tests

```
□ Seed script runs without errors on empty DB
□ Seed script is idempotent (running twice doesn't fail)
□ createTestUser creates user with hashed password
□ createTestWorkspace creates workspace + adds user as owner
□ createTestList creates list + seeds 3 default statuses
□ createTestTask creates task with correct materialized path + seq_id
```

---

## 6. Definition of Done

```
□ pnpm seed runs on empty DB, creates demo data
□ All fixture functions exported from packages/test-helpers
□ Fixtures use transaction isolation (work inside BEGIN/ROLLBACK)
□ pnpm test passes
```
