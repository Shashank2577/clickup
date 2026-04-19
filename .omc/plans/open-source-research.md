# Open Source Research Plan
## Sources: Plane · Huly · Focalboard

This document captures production-proven insights from three open source projects
and maps each finding to a concrete change in our architecture.

---

## 1. Plane (makeplane/plane)
*Open source Linear/Jira alternative — Django + PostgreSQL + Next.js*

### 1.1 Insights to Adopt

#### Human-readable Task IDs (PROJ-42 style)
Plane keeps a separate `issue_sequences` ledger table — sequence numbers survive
soft-deletes and are never reused.

**Change:** Add `task_sequences` table to schema. Every task gets a `seq_id` like
`LIST-42` alongside its UUID. This is critical for UX — users reference tasks by
human ID, not UUID.

```sql
CREATE TABLE task_sequences (
  list_id   UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  seq_id    INTEGER NOT NULL,
  task_id   UUID,  -- NULL if task was deleted (ID still reserved)
  PRIMARY KEY (list_id, seq_id)
);
-- task.sequence_id = seq_id from this table (e.g. "42")
-- display as "{list_slug}-{seq_id}" on frontend
```

#### Float Sort Order (not integer)
All entities use `DOUBLE PRECISION` for position/ordering, defaulting to 65535.
Prepend: decrement by 10000. Append: increment by 10000.
This avoids full-reindex on reorder.
- **We already have `position FLOAT`** ✅ — correct, keep as is.
- Add a rebalance job (Wave 4) triggered when gap < 1.0.

#### State is Per-Project, Not a Global Enum
States have a `group` (backlog/started/completed/cancelled) but each list/project
owns its own state instances. Users customize status names.

**Change:** Add `task_statuses` table. The `tasks.status` column becomes a FK
to this table instead of a raw string.

```sql
CREATE TABLE task_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,  -- e.g. "In Progress", "Code Review"
  color       TEXT NOT NULL DEFAULT '#6366f1',
  group       TEXT NOT NULL CHECK (group IN ('backlog','unstarted','started','completed','cancelled')),
  position    DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE
);
```

#### Workspace-Level Views With Nullable Project Scope
`IssueView` is workspace-scoped; `project_id IS NULL` = workspace view.
Same table, one query path.

**Change:** Our `views` table (to be added) follows this pattern.

#### Per-User View State Stored Separately
Filter state, display preferences are never stored on the main view entity.
Per-user customizations on a shared view are separate rows.

**Change:** `view_user_state` table (per-user overrides on shared views).

#### Description Multi-Format Storage
Store: `content_json` (Prosemirror) + `content_text` (plain text for search).
Derive HTML at read time. Skip the binary Y.js field unless doing real-time
collaborative editing on task descriptions.

**Change:** Update `tasks.description` to be two columns: `description_json JSONB`
and `description_text TEXT` (for full-text search tsvector).

#### Things to AVOID from Plane
- Do NOT store 4 copies of description (JSON + HTML + text + binary) — sync bugs
- Do NOT use a single `filters` JSON blob for user preferences — use typed columns
- Do NOT have dual blocking system (IssueBlocker + IssueRelation) — we have one ✅

---

## 2. Huly (hcengineering/platform)
*TypeScript-native PM + collaboration platform — most mature real-time TypeScript PM tool*

### 2.1 Insights to Adopt

#### Transaction Ordering (Critical for Real-Time)
Timestamps (`modifiedOn`) cause race conditions under concurrent writes.
Two events with the same millisecond timestamp arrive out of order at clients.

**Change:** Add per-document sequence counter. Every task mutation increments
a per-task `version` integer. Clients track `lastSeenVersion` per task.
On reconnect: client sends `lastSeenVersion`, server replays missed events.

```sql
-- Add to tasks table:
version  BIGINT NOT NULL DEFAULT 0
-- Increment atomically on every update:
UPDATE tasks SET version = version + 1, ... WHERE id = $1
```

#### Two-Phase Real-Time: Write Confirmation vs. Broadcast
Huly separates:
1. **Transactor** — accepts mutations, returns confirmation to writer immediately
2. **HulyPulse** — broadcasts confirmed mutations to all other subscribers

**Mapping to our stack:**
- Service writes to DB, gets success response (this is our transactor)
- Service publishes NATS event (this is our HulyPulse trigger)
- WebSocket service subscribes to NATS and fans out to room subscribers

Our architecture already matches this pattern. ✅

#### Rate Limit on Write Path
Huly had to add 250 req/30 sec on their transactor explicitly after AI bots and
bulk imports saturated it.

**Change:** Add rate limiting to the API gateway per workspace per user.
Document: `250 mutations / 30 seconds` per user per workspace.
Implement in Wave 2 (api-gateway work order).

#### Y.js CRDT — Only for Rich Text
Use Y.js only for document body collaborative editing.
For structured fields (status, assignee, due date): use last-write-wins
with the `version` counter for conflict detection.

**Change:** `docs-service` uses Y.js for document body.
Task structured fields use optimistic locking via `version`.

#### Reconnect Grace Period
Suppress sync-error UI for the first 2 seconds after reconnect.
Give the WebSocket time to replay missed events before showing errors.

**Change:** Document in frontend work order: "suppress collaboration error
notifications for 2000ms after WebSocket reconnect."

#### Branded Type References
```typescript
type Ref<T extends Entity> = string & { __ref: T }
// Prevents: taskId passed where workspaceId expected
```
**Change:** Add to `@clickup/contracts`:
```typescript
export type TaskId = string & { __brand: 'TaskId' }
export type UserId = string & { __brand: 'UserId' }
export type WorkspaceId = string & { __brand: 'WorkspaceId' }
// ... etc
```

#### Things to AVOID from Huly
- Do NOT use dual WebSocket endpoints (Transactor + HulyPulse) — one WS connection per client
- Do NOT have 94 packages — our 2 packages (contracts + sdk) is correct ✅
- Do NOT use Y.js CRDT for structured task fields — only for doc bodies
- Do NOT use CockroachDB — Postgres is correct ✅

---

## 3. Focalboard (mattermost/focalboard)
*Go + TypeScript views engine — best reference for multi-view architecture*

### 3.1 Insights to Adopt

#### Views Table with JSONB Config
All view state (filters, sorts, grouping, column widths, visibility) stored as
a single JSONB column. This is correct — filters evolve frequently, schema
migrations for filter changes are expensive.

**Change:** Add `views` table:

```sql
CREATE TABLE views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         UUID REFERENCES lists(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('list','board','calendar','timeline','table','workload')),
  config          JSONB NOT NULL DEFAULT '{}',  -- filters, sorts, grouping, column config
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- list_id IS NULL = workspace-level view
CREATE INDEX idx_views_list ON views (list_id) WHERE list_id IS NOT NULL;
CREATE INDEX idx_views_workspace ON views (workspace_id);
CREATE INDEX idx_views_config ON views USING GIN (config);
```

`config` shape (TypeScript type to add to contracts):
```typescript
interface ViewConfig {
  groupById?: string               // property ID for kanban grouping
  datePropertyId?: string          // for calendar view
  sortOptions: SortOption[]
  visiblePropertyIds: string[]
  filter: FilterGroup
  columnWidths: Record<string, number>
}
interface FilterGroup {
  operation: 'and' | 'or'
  filters: Array<FilterClause | FilterGroup>
}
interface FilterClause {
  propertyId: string
  condition: FilterCondition
  values: string[]
}
```

#### Property Schema on List, Values on Task
Focalboard: schema on Board, values on Card (by template ID).
This is cleaner than our current `custom_fields` approach where schema is
workspace-level. Property values should be filterable server-side.

**Change:** Our `custom_fields` schema stays workspace-scoped (reuse across lists ✅).
But add indexed `task_custom_fields` queries. Current schema is: `(task_id, field_id, value JSONB)`.
Add a `value_text` computed column for text-based filter indexing.

#### Card Ordering as Join Table (Not JSON Array)
Focalboard hits a JSON array size limit at 10k cards in `cardOrder`.
**Change:** Use our existing `tasks.position DOUBLE PRECISION` for ordering ✅.
For view-specific ordering overrides (drag in one view doesn't affect others):

```sql
CREATE TABLE view_task_order (
  view_id     UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position    DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (view_id, task_id)
);
```

#### Server-Side Filter Evaluation
Focalboard fetches ALL cards and filters in TypeScript — their biggest scale weakness.

**Change (Architecture rule for view-service):**
Convert `FilterGroup` tree to SQL WHERE clauses server-side.
Never fetch all tasks and filter in TypeScript.
Document this in the view-service work order as a hard constraint.

#### Per-User View State
```sql
CREATE TABLE view_user_state (
  view_id         UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collapsed_groups TEXT[] NOT NULL DEFAULT '{}',
  hidden_columns   TEXT[] NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (view_id, user_id)
);
```

#### Things to AVOID from Focalboard
- Do NOT store `cardOrder` as a JSON array on the view — use join table ✅
- Do NOT filter tasks client-side — evaluate FilterGroup in SQL ✅
- Do NOT store property schema on cards — schema on list, values by ID ✅
- Do NOT use single-table inheritance for all block types — use separate tables ✅
- Do NOT store stale option IDs in property values without handling at read time

---

## 4. Schema Changes Required (Delta from 001_initial.sql)

These changes go into a new migration file: `002_research_improvements.sql`

### Changes:
1. **`task_sequences` table** — human-readable task IDs (Plane)
2. **`task_statuses` table** — per-list custom statuses (Plane)
3. **`tasks.version` column** — optimistic locking + event ordering (Huly)
4. **`tasks.description` split** — `description_json JSONB` + `description_text TEXT` (Plane)
5. **`views` table** — JSONB view config (Focalboard)
6. **`view_task_order` table** — per-view card ordering (Focalboard)
7. **`view_user_state` table** — per-user view preferences (Plane + Focalboard)

### Contracts Updates Required:
1. Add `ViewConfig`, `FilterGroup`, `FilterClause` types to `contracts/types/entities.ts`
2. Add `View`, `ViewUserState` entity types
3. Add `CreateViewSchema`, `UpdateViewSchema` to schemas
4. Add `VIEW_EVENTS` to events.ts
5. Add branded ID types (`TaskId`, `UserId`, `WorkspaceId`) to entities.ts

---

## 5. Architecture Rules Updated

From this research, these rules are added to all future work orders:

| Rule | Source | Where Applied |
|------|--------|---------------|
| Never filter tasks in TypeScript — use SQL WHERE | Focalboard | view-service work order |
| Increment `tasks.version` on every mutation | Huly | task-service work order |
| Rate limit: 250 mutations/30s per user per workspace | Huly | api-gateway work order |
| Human-readable ID (seq_id) on every task create | Plane | task-service work order |
| Status is a FK to `task_statuses`, not raw string | Plane | task-service work order |
| Suppress WS error UI for 2000ms post-reconnect | Huly | frontend work order |
| View ordering uses `view_task_order` join table | Focalboard | view-service work order |
| Y.js CRDT only in docs-service, never task fields | Huly | docs-service work order |

---

## 6. What We Chose NOT to Adopt (and Why)

| Pattern | Source | Reason Not Adopted |
|---------|--------|-------------------|
| Single-table `blocks` for all entities | Focalboard | Weak typing, expensive cross-type queries, no FK enforcement |
| `@Model` decorators + reflection | Huly | Build pipeline complexity, reflection is slow |
| Dual WS endpoints (Transactor + HulyPulse) | Huly | We solve this with NATS — one WS per client |
| Y.js CRDT for structured fields | Huly | Overkill; last-write-wins with version is sufficient |
| 4-format description storage | Plane | Sync bugs; 2 formats (JSON + text) is sufficient |
| Client-side filter evaluation | Focalboard | Doesn't scale past ~500 tasks per list |
| CockroachDB | Huly | Operational complexity without multi-region benefit |
