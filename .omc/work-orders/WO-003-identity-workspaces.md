# Work Order — Identity Service: Workspaces & Members
**Wave:** 1
**Session ID:** WO-003
**Depends on:** WO-001 (auth must exist)
**Branch name:** `wave1/identity-workspaces`
**Estimated time:** 2 hours

---

## 1. Mission

Implement workspace CRUD, member invite/remove/role-change, and membership
verification. This is the tenant management layer — every workspace_id
in the system traces back here.

---

## 2. Context

```
Client → POST /api/v1/workspaces          → identity-service → PostgreSQL
Client → GET  /api/v1/workspaces/me       → identity-service → PostgreSQL
Client → GET  /api/v1/workspaces/:id/members → identity-service → PostgreSQL
Other services → GET /api/v1/workspaces/:id/members/:userId (membership check)
```

Publishes:
- `workspace.member_added` on invite accepted
- `workspace.member_removed` on member removal

---

## 3. Files to Add

```
services/identity-service/src/
└── workspaces/
    ├── workspaces.handler.ts
    ├── workspaces.service.ts
    └── workspaces.repository.ts
```

---

## 4. Imports

```typescript
import {
  CreateWorkspaceSchema, UpdateWorkspaceSchema,
  InviteMemberSchema, UpdateMemberRoleSchema,
  Workspace, WorkspaceMember, WorkspaceSummary,
  ErrorCode,
  WORKSPACE_EVENTS,
  WorkspaceMemberAddedEvent, WorkspaceMemberRemovedEvent,
  UserRole,
} from '@clickup/contracts'

import {
  requireAuth, requireRole, AppError, asyncHandler, validate,
  tier2Get, tier2Set, tier2Del, CacheKeys,
  publish, logger,
} from '@clickup/sdk'
```

---

## 5. Database Tables

| Table | Access | Notes |
|-------|--------|-------|
| `workspaces` | READ + WRITE | Tenant entity |
| `workspace_members` | READ + WRITE | Membership join table |
| `users` | READ ONLY | Resolve member user details |

---

## 6. API Endpoints

### 6.1 Create Workspace
```
POST /api/v1/workspaces
Auth: requireAuth
Body: CreateWorkspaceSchema { name, slug }
```

**Logic:**
```typescript
// Check slug not taken
const existing = await repository.getWorkspaceBySlug(input.slug)
if (existing) throw new AppError(ErrorCode.WORKSPACE_SLUG_TAKEN)

// Create workspace + add creator as owner (atomic transaction)
const workspace = await db.transaction(async (tx) => {
  const ws = await repository.createWorkspace(tx, { ...input, ownerId: req.auth.userId })
  await repository.addMember(tx, { workspaceId: ws.id, userId: req.auth.userId, role: UserRole.Owner })
  return ws
})

res.status(201).json({ data: workspace })
```

---

### 6.2 Get My Workspaces
```
GET /api/v1/workspaces/me
Auth: requireAuth
```

Returns all workspaces the current user is a member of, with their role.

**Query:**
```sql
SELECT w.*, wm.role, wm.joined_at
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE wm.user_id = $1
  AND w.deleted_at IS NULL
ORDER BY wm.joined_at ASC
```

---

### 6.3 Get Workspace
```
GET /api/v1/workspaces/:workspaceId
Auth: requireAuth
```

Only members can fetch workspace details.

**Guard:**
```typescript
const member = await repository.getMember(workspaceId, req.auth.userId)
if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
```

---

### 6.4 Update Workspace
```
PATCH /api/v1/workspaces/:workspaceId
Auth: requireAuth + requireRole('owner', 'admin')
Body: UpdateWorkspaceSchema { name?, logoUrl? }
```

---

### 6.5 Invite Member
```
POST /api/v1/workspaces/:workspaceId/members
Auth: requireAuth + requireRole('owner', 'admin')
Body: InviteMemberSchema { email, role }
```

**Logic:**
```typescript
// Find user by email (must already have an account)
const user = await repository.getUserByEmail(input.email)
if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)

// Check not already a member
const existing = await repository.getMember(workspaceId, user.id)
if (existing) throw new AppError(ErrorCode.WORKSPACE_MEMBER_ALREADY_EXISTS)

// Add member
await repository.addMember(db, { workspaceId, userId: user.id, role: input.role })

// Publish event
await publish(WORKSPACE_EVENTS.MEMBER_ADDED, {
  workspaceId,
  userId: user.id,
  role: input.role,
  addedBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
} satisfies WorkspaceMemberAddedEvent)

// Invalidate workspace members cache
await tier2Del(CacheKeys.workspaceMembers(workspaceId))
```

**Success** `HTTP 201`

---

### 6.6 Remove Member
```
DELETE /api/v1/workspaces/:workspaceId/members/:userId
Auth: requireAuth + requireRole('owner', 'admin')
```

**Guard:** Cannot remove the workspace owner.
```typescript
const member = await repository.getMember(workspaceId, userId)
if (!member) throw new AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND)
if (member.role === UserRole.Owner) throw new AppError(ErrorCode.WORKSPACE_OWNER_CANNOT_LEAVE)
```

**After removal:** Publish `workspace.member_removed`, invalidate cache.

---

### 6.7 Update Member Role
```
PATCH /api/v1/workspaces/:workspaceId/members/:userId
Auth: requireAuth + requireRole('owner')
Body: UpdateMemberRoleSchema { role }
```

Cannot change the owner's role.

---

### 6.8 Get Members (critical — called by all other services for auth checks)
```
GET /api/v1/workspaces/:workspaceId/members
Auth: requireAuth
```

**Cache-aside (Tier 2 — 60s):**
```typescript
const cacheKey = CacheKeys.workspaceMembers(workspaceId)
const cached = await tier2Get<WorkspaceMember[]>(cacheKey)
if (cached) return res.json({ data: cached })

const members = await repository.getMembers(workspaceId)
await tier2Set(cacheKey, members)
res.json({ data: members })
```

---

### 6.9 Check Membership (internal — other services call this)
```
GET /api/v1/workspaces/:workspaceId/members/:userId
Auth: requireAuth
```

Returns 200 with member data if member, 404 if not.
Other services call this to verify workspace access.

---

## 7. Repository Queries

```typescript
getWorkspaceBySlug(slug: string): Promise<WorkspaceRow | null>
createWorkspace(tx, input): Promise<WorkspaceRow>
getWorkspace(id: string): Promise<WorkspaceRow | null>
getUserWorkspaces(userId: string): Promise<Array<WorkspaceRow & { role: string }>>
updateWorkspace(id: string, input): Promise<WorkspaceRow>
addMember(tx, input: { workspaceId, userId, role }): Promise<void>
getMember(workspaceId: string, userId: string): Promise<MemberRow | null>
getMembers(workspaceId: string): Promise<MemberRow[]>
removeMember(workspaceId: string, userId: string): Promise<void>
updateMemberRole(workspaceId: string, userId: string, role: string): Promise<void>
getUserByEmail(email: string): Promise<UserRow | null>
```

---

## 8. Mandatory Tests

### Unit Tests
```
□ createWorkspace: adds creator as 'owner' atomically
□ createWorkspace: throws WORKSPACE_SLUG_TAKEN if slug exists
□ inviteMember: throws USER_NOT_FOUND if email not registered
□ inviteMember: throws WORKSPACE_MEMBER_ALREADY_EXISTS on duplicate
□ removeMember: throws WORKSPACE_OWNER_CANNOT_LEAVE for owner
□ getMembers: returns from cache on second call
□ getMembers: cache invalidated after member added/removed
```

### Integration Tests
```
□ POST /workspaces → 201, creator is owner in members table
□ POST /workspaces duplicate slug → 409 WORKSPACE_SLUG_TAKEN
□ GET /workspaces/me → lists all user's workspaces with roles
□ GET /workspaces/:id not a member → 403
□ POST /workspaces/:id/members valid → 201, member in DB, event published
□ POST /workspaces/:id/members non-existent email → 404 USER_NOT_FOUND
□ POST /workspaces/:id/members duplicate → 409
□ DELETE /workspaces/:id/members/:userId → 204, event published
□ DELETE /workspaces/:id/members owner → 422 WORKSPACE_OWNER_CANNOT_LEAVE
□ GET /workspaces/:id/members → returns members array (cached second call)
□ GET /workspaces/:id/members/:userId member → 200
□ GET /workspaces/:id/members/:userId non-member → 404
```

---

## 9. Definition of Done

```
□ Workspace creation is atomic (workspace + owner member in one transaction)
□ Cache invalidated on all member mutations
□ Events published after DB writes, never inside transaction
□ pnpm typecheck, lint, test pass
□ Coverage ≥ 80%
```
