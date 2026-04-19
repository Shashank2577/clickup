# Work Order — Identity Service: Spaces & Lists
**Wave:** 1
**Session ID:** WO-004
**Depends on:** WO-001 (auth), WO-003 (workspaces must exist)
**Branch name:** `wave1/identity-spaces-lists`
**Estimated time:** 1.5 hours

---

## 1. Mission

Implement Space and List CRUD. Spaces are department/team containers inside
a workspace. Lists are task containers inside a space. Every task belongs
to a list — this is the hierarchy root for the task service.

---

## 2. Context

```
Workspace → Spaces → Lists → Tasks (tasks live in task-service)

Client → POST /api/v1/workspaces/:id/spaces → identity-service
Client → GET  /api/v1/workspaces/:id/spaces → identity-service
Client → POST /api/v1/spaces/:id/lists      → identity-service
Client → GET  /api/v1/spaces/:id/lists      → identity-service

task-service calls: GET /api/v1/lists/:id (verify list exists + get workspaceId)
```

---

## 3. Files to Add

```
services/identity-service/src/
├── spaces/
│   ├── spaces.handler.ts
│   ├── spaces.service.ts
│   └── spaces.repository.ts
└── lists/
    ├── lists.handler.ts
    ├── lists.service.ts
    └── lists.repository.ts
```

---

## 4. API Endpoints

### Spaces

#### 4.1 Create Space
```
POST /api/v1/workspaces/:workspaceId/spaces
Auth: requireAuth + must be workspace member (admin/owner)
Body: CreateSpaceSchema { name, color?, icon?, isPrivate? }
```

**Default position:** fetch MAX(position) from spaces in workspace + 1000

#### 4.2 List Spaces
```
GET /api/v1/workspaces/:workspaceId/spaces
Auth: requireAuth + must be workspace member
```

Returns spaces the user can see:
```sql
SELECT * FROM spaces
WHERE workspace_id = $1
  AND deleted_at IS NULL
  AND (is_private = FALSE OR created_by = $2)
ORDER BY position ASC
```

#### 4.3 Get Space
```
GET /api/v1/spaces/:spaceId
Auth: requireAuth
```

#### 4.4 Update Space
```
PATCH /api/v1/spaces/:spaceId
Auth: requireAuth + admin/owner
Body: UpdateSpaceSchema
```

#### 4.5 Delete Space (soft delete)
```
DELETE /api/v1/spaces/:spaceId
Auth: requireAuth + owner only
```

Soft-delete the space. Lists inside are also soft-deleted via:
```sql
UPDATE lists SET deleted_at = NOW()
WHERE space_id = $1 AND deleted_at IS NULL
```

---

### Lists

#### 4.6 Create List
```
POST /api/v1/spaces/:spaceId/lists
Auth: requireAuth + workspace member
Body: CreateListSchema { name, color? }
```

**On create:** also seed default task statuses for this list:
```typescript
await repository.seedDefaultStatuses(db, listId)
// Inserts: Backlog, Todo, In Progress, Done, Cancelled
```

Default statuses to seed:
```typescript
const DEFAULT_STATUSES = [
  { name: 'Backlog',     color: '#94a3b8', group: 'backlog',    position: 0,    isDefault: false },
  { name: 'Todo',        color: '#64748b', group: 'unstarted',  position: 1000, isDefault: true  },
  { name: 'In Progress', color: '#3b82f6', group: 'started',    position: 2000, isDefault: false },
  { name: 'Done',        color: '#22c55e', group: 'completed',  position: 3000, isDefault: false },
  { name: 'Cancelled',   color: '#ef4444', group: 'cancelled',  position: 4000, isDefault: false },
]
```

#### 4.7 List Lists
```
GET /api/v1/spaces/:spaceId/lists
Auth: requireAuth + workspace member
```

```sql
SELECT * FROM lists
WHERE space_id = $1 AND deleted_at IS NULL
ORDER BY position ASC
```

#### 4.8 Get List (critical — called by task-service)
```
GET /api/v1/lists/:listId
Auth: requireAuth
```

Returns list with its `spaceId` and resolved `workspaceId` (via space join).
task-service calls this to verify a list exists and get the workspaceId.

**Query:**
```sql
SELECT l.*, s.workspace_id
FROM lists l
JOIN spaces s ON s.id = l.space_id
WHERE l.id = $1
  AND l.deleted_at IS NULL
  AND s.deleted_at IS NULL
```

Returns: `{ ...list, workspaceId }`

#### 4.9 Update List
```
PATCH /api/v1/lists/:listId
Auth: requireAuth + workspace member
Body: UpdateListSchema { name?, color?, isArchived? }
```

#### 4.10 Delete List (soft delete)
```
DELETE /api/v1/lists/:listId
Auth: requireAuth + admin/owner
```

---

## 5. Repository Queries

```typescript
// Spaces
createSpace(input): Promise<SpaceRow>
getSpace(id: string): Promise<SpaceRow | null>
getSpacesByWorkspace(workspaceId: string, userId: string): Promise<SpaceRow[]>
updateSpace(id: string, input): Promise<SpaceRow>
softDeleteSpace(id: string): Promise<void>
softDeleteListsBySpace(spaceId: string): Promise<void>
getMaxSpacePosition(workspaceId: string): Promise<number>

// Lists
createList(input): Promise<ListRow>
getList(id: string): Promise<ListRow & { workspaceId: string } | null>
getListsBySpace(spaceId: string): Promise<ListRow[]>
updateList(id: string, input): Promise<ListRow>
softDeleteList(id: string): Promise<void>
seedDefaultStatuses(db, listId: string): Promise<void>
getMaxListPosition(spaceId: string): Promise<number>
```

---

## 6. Caching

| Data | Tier | Key | Invalidate When |
|------|------|-----|-----------------|
| Space hierarchy | Tier 2 (60s) | `CacheKeys.spaceHierarchy(workspaceId)` | Space created/updated/deleted |

---

## 7. Mandatory Tests

### Integration Tests
```
□ POST /workspaces/:id/spaces → 201, space in DB
□ POST /workspaces/:id/spaces non-member → 403
□ GET /workspaces/:id/spaces → returns only visible spaces (private excluded if not creator)
□ DELETE /spaces/:id → soft-deletes space + all its lists
□ POST /spaces/:id/lists → 201, list in DB with 5 default statuses seeded
□ GET /lists/:id → returns list with workspaceId resolved
□ GET /lists/:id soft-deleted → 404
□ GET /lists/:id non-member workspace → 403
□ PATCH /lists/:id isArchived=true → list archived
```

---

## 8. Definition of Done

```
□ Default statuses seeded on every new list (5 statuses)
□ Soft-deleting a space also soft-deletes its lists
□ GET /lists/:id returns workspaceId (critical for task-service)
□ Private spaces only visible to creator
□ pnpm typecheck, lint, test pass
□ Coverage ≥ 80%
```
