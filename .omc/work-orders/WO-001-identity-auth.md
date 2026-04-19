# Work Order — Identity Service: Auth
**Wave:** 1
**Session ID:** WO-001
**Depends on:** WO-000 (foundation)
**Branch name:** `wave1/identity-auth`
**Estimated time:** 2 hours

---

## 1. Mission

Implement user registration, login, logout, and JWT session management.
This is the entry point for every user into the system. Every other service
calls identity-service to verify auth tokens. Get this right — everything
depends on it.

---

## 2. Context

```
Client → POST /api/v1/auth/register → identity-service (:3001) → PostgreSQL
Client → POST /api/v1/auth/login    → identity-service (:3001) → PostgreSQL
Client → POST /api/v1/auth/logout   → identity-service (:3001) → PostgreSQL

identity-service publishes: (none from auth module)
Other services call: GET /api/v1/auth/verify (internal — validates JWT)
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/identity-service
cd services/identity-service
# package.json: "name": "@clickup/identity-service"
# .env: SERVICE_NAME=identity-service, PORT=3001
```

Additional dependency needed:
```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

---

## 4. Files to Create

```
services/identity-service/src/
├── index.ts                          [from template]
├── routes.ts                         [register auth + user + workspace routes]
├── auth/
│   ├── auth.handler.ts
│   ├── auth.service.ts
│   └── auth.repository.ts
```

---

## 5. Imports

```typescript
import {
  RegisterSchema, LoginSchema,
  ErrorCode,
  WORKSPACE_EVENTS,
} from '@clickup/contracts'

import {
  AppError, asyncHandler, validate,
  signToken, logger,
} from '@clickup/sdk'

import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
```

---

## 6. Database Tables

| Table | Access | Notes |
|-------|--------|-------|
| `users` | READ + WRITE | Core user entity |
| `sessions` | READ + WRITE | JWT session tracking |

---

## 7. API Endpoints

### 7.1 Register
```
POST /api/v1/auth/register
Auth: none
Body: RegisterSchema { email, password, name, timezone? }
```

**Logic:**
```typescript
// 1. Check email not taken
const existing = await repository.getUserByEmail(input.email)
if (existing) throw new AppError(ErrorCode.USER_EMAIL_TAKEN)

// 2. Hash password (never store plaintext)
const passwordHash = await bcrypt.hash(input.password, 12)

// 3. Create user
const user = await repository.createUser({ ...input, passwordHash })

// 4. Create session
const sessionId = randomUUID()
const token = signToken({
  userId: user.id,
  workspaceId: '',   // empty until user joins/creates workspace
  role: 'member',
  sessionId,
})
const tokenHash = await bcrypt.hash(token, 8)
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
await repository.createSession({ id: sessionId, userId: user.id, tokenHash, expiresAt })

// 5. Return
return { user: toUserDto(user), token }
```

**Success** `HTTP 201`:
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "createdAt": "..." },
    "token": "eyJ..."
  }
}
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| Email already exists | `USER_EMAIL_TAKEN` |
| Validation failure | `VALIDATION_INVALID_INPUT` |

---

### 7.2 Login
```
POST /api/v1/auth/login
Auth: none
Body: LoginSchema { email, password }
```

**Logic:**
```typescript
// 1. Find user by email
const user = await repository.getUserByEmail(input.email)
// Important: same error for wrong email OR wrong password (don't leak info)
if (!user) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

// 2. Verify password
const valid = await bcrypt.compare(input.password, user.passwordHash)
if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

// 3. Create session + sign JWT
// (same as register step 4)
```

**Success** `HTTP 200`:
```json
{ "data": { "user": { ... }, "token": "eyJ..." } }
```

**Errors:**
| Condition | ErrorCode |
|-----------|-----------|
| Wrong email or password | `AUTH_INVALID_CREDENTIALS` (same error, don't distinguish) |

---

### 7.3 Logout
```
POST /api/v1/auth/logout
Auth: requireAuth
Body: none
```

**Logic:** Delete session row by `req.auth.sessionId`.

**Success** `HTTP 204`: no body

---

### 7.4 Verify Token (Internal — called by other services)
```
GET /api/v1/auth/verify
Auth: requireAuth middleware validates the token
Body: none
```

**Success** `HTTP 200`:
```json
{
  "data": {
    "userId": "uuid",
    "workspaceId": "uuid",
    "role": "member",
    "sessionId": "uuid"
  }
}
```

This endpoint is called by the API gateway to validate tokens for proxied requests.
Other services use the SDK `requireAuth` middleware directly — they don't call this endpoint.

---

### 7.5 Refresh Token
```
POST /api/v1/auth/refresh
Auth: requireAuth
Body: none
```

**Logic:**
```typescript
// Verify session still exists in DB (not logged out)
const session = await repository.getSession(req.auth.sessionId)
if (!session || session.expiresAt < new Date()) {
  throw new AppError(ErrorCode.AUTH_EXPIRED_TOKEN)
}

// Issue new token, extend session
const newToken = signToken({ ...req.auth })
const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
await repository.updateSessionExpiry(session.id, newExpiresAt)
```

**Success** `HTTP 200`:
```json
{ "data": { "token": "eyJ..." } }
```

---

## 8. Repository Queries

```typescript
// auth.repository.ts — ALL SQL lives here

async getUserByEmail(email: string): Promise<UserRow | null>
// SELECT id, email, name, avatar_url, timezone, password_hash, created_at
// FROM users WHERE email = $1 AND deleted_at IS NULL

async createUser(input: { email, name, passwordHash, timezone }): Promise<UserRow>
// INSERT INTO users (id, email, name, password_hash, timezone)
// VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *

async createSession(input: { id, userId, tokenHash, expiresAt }): Promise<void>
// INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (...)

async getSession(sessionId: string): Promise<SessionRow | null>
// SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()

async deleteSession(sessionId: string): Promise<void>
// DELETE FROM sessions WHERE id = $1

async updateSessionExpiry(sessionId: string, expiresAt: Date): Promise<void>
// UPDATE sessions SET expires_at = $1 WHERE id = $2
```

**Note:** The `users` table does NOT have a `password_hash` column in the schema.
Add it in a new migration file:
```sql
-- services/identity-service/migrations/001_add_password_hash.sql
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
```
Run this migration before the service starts (add to bootstrap).

---

## 9. Events to Publish

None from auth module. User created → no event (no other service needs to react yet).

---

## 10. Caching

None in auth module. Sessions are checked against DB on every /verify call.

---

## 11. Mandatory Tests

### Unit Tests
```
□ register: creates user + session, returns JWT
□ register: throws USER_EMAIL_TAKEN when email exists
□ register: password is hashed (bcrypt.compare works on stored hash)
□ login: returns JWT on valid credentials
□ login: throws AUTH_INVALID_CREDENTIALS on wrong password
□ login: throws AUTH_INVALID_CREDENTIALS on wrong email (same error code)
□ logout: deletes session from DB
□ refresh: returns new token when session valid
□ refresh: throws AUTH_EXPIRED_TOKEN when session expired
```

### Integration Tests (real DB)
```
□ POST /auth/register → 201, JWT valid, user in DB
□ POST /auth/register same email twice → 409 USER_EMAIL_TAKEN
□ POST /auth/register missing password → 422 VALIDATION_INVALID_INPUT
□ POST /auth/register weak password → 422 (regex check)
□ POST /auth/login valid credentials → 200 with JWT
□ POST /auth/login wrong password → 401 AUTH_INVALID_CREDENTIALS
□ POST /auth/login unknown email → 401 AUTH_INVALID_CREDENTIALS
□ POST /auth/logout → 204, session deleted
□ GET /auth/verify with valid token → 200 with auth context
□ GET /auth/verify with expired token → 401 AUTH_EXPIRED_TOKEN
□ GET /auth/verify with no token → 401 AUTH_MISSING_TOKEN
□ GET /auth/verify with tampered token → 401 AUTH_INVALID_TOKEN
```

---

## 12. Definition of Done

```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings
□ pnpm test — all tests pass
□ Coverage ≥ 80%
□ GET /health returns 200
□ Passwords never logged or returned in API responses
□ Same error code for wrong email vs wrong password (no user enumeration)
□ .env not committed
```

---

## 13. Constraints

```
✗ Do NOT store plaintext passwords anywhere
✗ Do NOT return password_hash in any API response
✗ Do NOT differentiate "wrong email" from "wrong password" in error responses
✗ Do NOT implement OAuth in this WO (that's WO-088)
✗ Do NOT implement workspace creation here (that's WO-003)
```

---

## 14. Allowed Dependencies

```json
{ "bcrypt": "^5.1.0", "@types/bcrypt": "^5.0.0" }
```
