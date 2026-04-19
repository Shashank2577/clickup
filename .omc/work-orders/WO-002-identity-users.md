# Work Order — Identity Service: Users
**Wave:** 1
**Session ID:** WO-002
**Depends on:** WO-001 (identity-auth must be merged first)
**Branch name:** `wave1/identity-users`
**Estimated time:** 1.5 hours

---

## 1. Mission

Implement user profile management: get profile, update name/avatar/timezone,
change password. These are the user-facing account settings endpoints.

---

## 2. Context

```
Client → GET /api/v1/users/me       → identity-service (:3001) → PostgreSQL
Client → PATCH /api/v1/users/me     → identity-service (:3001) → PostgreSQL
Client → GET /api/v1/users/:id      → identity-service (:3001) → PostgreSQL (read-only lookup)
```

---

## 3. Files to Add (inside existing identity-service)

```
services/identity-service/src/
└── users/
    ├── users.handler.ts
    ├── users.service.ts
    └── users.repository.ts
```

Add to `routes.ts`: `app.use('/api/v1/users', userRoutes(db))`

---

## 4. Imports

```typescript
import {
  UpdateProfileSchema, ChangePasswordSchema,
  User, ErrorCode,
} from '@clickup/contracts'

import {
  requireAuth, AppError, asyncHandler, validate,
  tier2Get, tier2Set, tier2Del, CacheKeys, logger,
} from '@clickup/sdk'

import bcrypt from 'bcrypt'
```

---

## 5. Database Tables

| Table | Access | Notes |
|-------|--------|-------|
| `users` | READ + WRITE | Never return password_hash |
| `sessions` | READ ONLY | For change password (invalidate all sessions) |

---

## 6. API Endpoints

### 6.1 Get My Profile
```
GET /api/v1/users/me
Auth: requireAuth
```

**Query (use cache-aside, Tier 2):**
```typescript
const cacheKey = CacheKeys.userProfile(req.auth.userId)
const cached = await tier2Get<User>(cacheKey)
if (cached) return res.json({ data: cached })

const user = await repository.getUserById(req.auth.userId)
if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)

await tier2Set(cacheKey, toUserDto(user))
res.json({ data: toUserDto(user) })
```

**Success** `HTTP 200`: `{ "data": { User entity — no password_hash } }`

---

### 6.2 Update My Profile
```
PATCH /api/v1/users/me
Auth: requireAuth
Body: UpdateProfileSchema { name?, avatarUrl?, timezone? }
```

**Logic:**
```typescript
const input = validate(UpdateProfileSchema, req.body)
const user = await repository.updateUser(req.auth.userId, input)
// Invalidate cache
await tier2Del(CacheKeys.userProfile(req.auth.userId))
res.json({ data: toUserDto(user) })
```

**Success** `HTTP 200`: `{ "data": { User } }`

---

### 6.3 Change Password
```
POST /api/v1/users/me/change-password
Auth: requireAuth
Body: ChangePasswordSchema { currentPassword, newPassword, confirmPassword }
```

**Logic:**
```typescript
const input = validate(ChangePasswordSchema, req.body)

// Verify current password
const user = await repository.getUserWithHash(req.auth.userId)
const valid = await bcrypt.compare(input.currentPassword, user.passwordHash)
if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

// Hash + update
const newHash = await bcrypt.hash(input.newPassword, 12)
await repository.updatePasswordHash(req.auth.userId, newHash)

// Invalidate all other sessions (security best practice)
await repository.deleteAllSessionsExcept(req.auth.userId, req.auth.sessionId)
```

**Success** `HTTP 204`: no body

---

### 6.4 Get User by ID (for other services to look up users)
```
GET /api/v1/users/:userId
Auth: requireAuth
```

Returns minimal public profile. Used by other services to resolve user names.

**Success** `HTTP 200`:
```json
{ "data": { "id": "uuid", "name": "...", "email": "...", "avatarUrl": "..." } }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| User not found | `USER_NOT_FOUND` |

---

### 6.5 Batch Get Users (internal — for DataLoader use)
```
POST /api/v1/users/batch
Auth: requireAuth (internal calls only)
Body: { ids: string[] }
```

Returns array of user summaries. Used by task-service DataLoader to resolve assignees.
Max 100 IDs per request.

**Query:**
```sql
SELECT id, name, email, avatar_url
FROM users
WHERE id = ANY($1::uuid[])
  AND deleted_at IS NULL
```

---

## 7. Repository Queries

```typescript
getUserById(id: string): Promise<UserRow | null>
// SELECT id, email, name, avatar_url, timezone, created_at
// FROM users WHERE id = $1 AND deleted_at IS NULL

getUserWithHash(id: string): Promise<UserRow & { passwordHash: string } | null>
// SELECT *, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL

updateUser(id: string, input: UpdateProfileInput): Promise<UserRow>
// UPDATE users SET name=$2, avatar_url=$3, timezone=$4, updated_at=NOW()
// WHERE id=$1 AND deleted_at IS NULL RETURNING *

updatePasswordHash(id: string, hash: string): Promise<void>
// UPDATE users SET password_hash=$2, updated_at=NOW() WHERE id=$1

deleteAllSessionsExcept(userId: string, sessionId: string): Promise<void>
// DELETE FROM sessions WHERE user_id=$1 AND id != $2

batchGetUsers(ids: string[]): Promise<UserRow[]>
// SELECT id, name, email, avatar_url FROM users
// WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
```

---

## 8. DTO Helper

```typescript
// Never return password_hash — always use this function
function toUserDto(user: UserRow): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    timezone: user.timezone,
    createdAt: user.created_at.toISOString(),
  }
}
```

---

## 9. Mandatory Tests

### Unit Tests
```
□ getMyProfile: returns user DTO without password_hash
□ getMyProfile: uses cache on second call
□ updateProfile: invalidates cache after update
□ changePassword: throws AUTH_INVALID_CREDENTIALS on wrong current password
□ changePassword: invalidates all sessions except current
□ batchGetUsers: returns all found users, skips unknown IDs
```

### Integration Tests
```
□ GET /users/me → 200 with user (no password_hash field in response)
□ GET /users/me no auth → 401
□ PATCH /users/me valid body → 200 updated
□ PATCH /users/me invalid timezone → 422
□ POST /users/me/change-password valid → 204
□ POST /users/me/change-password wrong current → 401
□ GET /users/:id exists → 200
□ GET /users/:id not found → 404 USER_NOT_FOUND
□ POST /users/batch → returns array of found users
□ POST /users/batch with 101 IDs → 422 (max 100)
```

---

## 10. Definition of Done

```
□ password_hash NEVER appears in any API response (add test to verify)
□ Cache invalidated on profile update
□ All sessions invalidated on password change
□ pnpm typecheck, lint, test all pass
□ Coverage ≥ 80%
```

---

## 11. Constraints

```
✗ Do NOT return password_hash in any response
✗ Do NOT implement avatar upload here (that's file-service, WO-030)
✗ avatarUrl accepts a URL string — client uploads to file-service first
```
