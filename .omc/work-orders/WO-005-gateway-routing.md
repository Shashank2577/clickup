# Work Order — API Gateway: Routing & Proxy
**Wave:** 1
**Session ID:** WO-005
**Depends on:** WO-000 (foundation)
**Branch name:** `wave1/gateway-routing`
**Estimated time:** 2 hours

---

## 1. Mission

The API gateway is the single entry point for all client traffic.
It routes requests to the correct microservice, validates JWT tokens,
injects auth context headers, adds correlation IDs, and enforces
rate limits. Clients talk to one URL — the gateway handles the rest.

---

## 2. Context

```
Client (:80/:443)
  → API Gateway (:3000)
    → identity-service (:3001) — /api/v1/auth/*, /api/v1/users/*, /api/v1/workspaces/*
    → task-service (:3002)     — /api/v1/tasks/*, /api/v1/lists/:id/tasks
    → comment-service (:3003)  — /api/v1/tasks/:id/comments, /api/v1/comments/*
    → docs-service (:3004)     — /api/v1/docs/*
    → file-service (:3005)     — /api/v1/files/*
    → ai-service (:3006)       — /api/v1/ai/*
    → notification-service (:3007) — /api/v1/notifications/*
    → search-service (:3008)   — /api/v1/search
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/api-gateway
cd services/api-gateway
# package.json: "name": "@clickup/api-gateway"
# .env: SERVICE_NAME=api-gateway, PORT=3000
```

Additional dependency:
```bash
pnpm add http-proxy-middleware express-rate-limit
```

---

## 4. Files to Create

```
services/api-gateway/src/
├── index.ts
├── routes.ts
├── proxy/
│   ├── proxy.config.ts       [service URL map + route rules]
│   └── proxy.middleware.ts   [http-proxy-middleware setup]
├── middleware/
│   ├── rate-limiter.ts       [per-user rate limiting]
│   └── auth-forward.ts      [JWT validate + inject headers]
```

---

## 5. Proxy Configuration

```typescript
// proxy/proxy.config.ts
// Maps URL prefixes to upstream services

export const SERVICE_ROUTES = [
  // Public routes (no auth required — gateway passes through)
  { prefix: '/api/v1/auth/register', target: process.env['IDENTITY_SERVICE_URL'], public: true },
  { prefix: '/api/v1/auth/login',    target: process.env['IDENTITY_SERVICE_URL'], public: true },

  // All identity routes (auth required)
  { prefix: '/api/v1/auth',          target: process.env['IDENTITY_SERVICE_URL'], public: false },
  { prefix: '/api/v1/users',         target: process.env['IDENTITY_SERVICE_URL'], public: false },
  { prefix: '/api/v1/workspaces',    target: process.env['IDENTITY_SERVICE_URL'], public: false },
  { prefix: '/api/v1/spaces',        target: process.env['IDENTITY_SERVICE_URL'], public: false },
  { prefix: '/api/v1/lists',         target: process.env['IDENTITY_SERVICE_URL'], public: false },

  // Task service
  { prefix: '/api/v1/tasks',         target: process.env['TASK_SERVICE_URL'],     public: false },

  // Comment service
  { prefix: '/api/v1/comments',      target: process.env['COMMENT_SERVICE_URL'],  public: false },

  // Docs service
  { prefix: '/api/v1/docs',          target: process.env['DOCS_SERVICE_URL'],     public: false },

  // File service
  { prefix: '/api/v1/files',         target: process.env['FILE_SERVICE_URL'],     public: false },

  // AI service (internal only — no direct client access)
  // AI is called service-to-service, not directly by clients

  // Notification service
  { prefix: '/api/v1/notifications', target: process.env['NOTIFICATION_SERVICE_URL'], public: false },

  // Search
  { prefix: '/api/v1/search',        target: process.env['SEARCH_SERVICE_URL'],  public: false },

  // Goals, views, automations (Wave 3 services — add when live)
  { prefix: '/api/v1/goals',         target: process.env['GOAL_SERVICE_URL'],    public: false },
  { prefix: '/api/v1/views',         target: process.env['VIEW_SERVICE_URL'],    public: false },
  { prefix: '/api/v1/automations',   target: process.env['AUTOMATION_SERVICE_URL'], public: false },
  { prefix: '/api/v1/dashboards',    target: process.env['DASHBOARD_SERVICE_URL'], public: false },
]
```

---

## 6. Auth Forwarding Middleware

```typescript
// middleware/auth-forward.ts
// For non-public routes:
// 1. Extract Bearer token from Authorization header
// 2. Call identity-service GET /api/v1/auth/verify
// 3. If valid: inject x-user-id, x-workspace-id, x-role headers
// 4. If invalid: return 401

import { createServiceClient } from '@clickup/sdk'
import { AppError, ErrorCode } from '@clickup/sdk'

export async function authForward(req, res, next) {
  const token = req.headers.authorization?.slice(7)
  if (!token) throw new AppError(ErrorCode.AUTH_MISSING_TOKEN)

  const identityClient = createServiceClient(
    process.env['IDENTITY_SERVICE_URL'],
    { traceId: req.headers['x-trace-id'] }
  )

  try {
    const { data } = await identityClient.get('/api/v1/auth/verify', {
      headers: { Authorization: `Bearer ${token}` }
    })

    // Inject auth context for downstream services
    req.headers['x-user-id'] = data.userId
    req.headers['x-workspace-id'] = data.workspaceId
    req.headers['x-role'] = data.role
    req.headers['x-session-id'] = data.sessionId

    next()
  } catch {
    throw new AppError(ErrorCode.AUTH_INVALID_TOKEN)
  }
}
```

**Note for downstream services:** Services can trust `x-user-id` headers from
internal requests (marked with `x-internal: true`). They do NOT re-verify JWT —
the gateway already did it.

---

## 7. Rate Limiting

```typescript
// middleware/rate-limiter.ts
// 250 mutations per 30 seconds per user (Huly lesson)
// Read requests: 1000 per 60 seconds per user

import rateLimit from 'express-rate-limit'
import { getRedis } from '@clickup/sdk'

// Use Redis for distributed rate limiting (works across multiple gateway instances)
export const mutationRateLimit = rateLimit({
  windowMs: 30 * 1000,
  max: 250,
  keyGenerator: (req) => req.headers['x-user-id'] as string || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'SYSTEM_RATE_LIMITED',
        message: 'Too many requests',
        status: 429,
        traceId: 'unknown',
      }
    })
  },
  // Apply only to mutation methods
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
})

export const readRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.headers['x-user-id'] as string || req.ip,
})
```

---

## 8. Health Aggregation

```
GET /health — gateway's own health
GET /health/services — ping all upstream /health endpoints, return aggregate
```

```typescript
// GET /health/services
const results = await Promise.allSettled(
  SERVICE_URLS.map(async ({ name, url }) => {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })
    return { name, status: resp.ok ? 'ok' : 'degraded' }
  })
)
res.json({ services: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'unreachable' }) })
```

---

## 9. .env.example

```
SERVICE_NAME=api-gateway
PORT=3000
LOG_LEVEL=info

# Upstream services
IDENTITY_SERVICE_URL=http://localhost:3001
TASK_SERVICE_URL=http://localhost:3002
COMMENT_SERVICE_URL=http://localhost:3003
DOCS_SERVICE_URL=http://localhost:3004
FILE_SERVICE_URL=http://localhost:3005
AI_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007
SEARCH_SERVICE_URL=http://localhost:3008

# Redis for rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (same secret as all other services)
JWT_SECRET=change-me-in-production
```

---

## 10. Mandatory Tests

### Integration Tests
```
□ GET /health → 200 gateway healthy
□ GET /health/services → returns status of all upstream services
□ Public route (POST /api/v1/auth/login) → proxied without auth check
□ Private route without token → 401 AUTH_MISSING_TOKEN
□ Private route with valid token → proxied with x-user-id header injected
□ Private route with expired token → 401 AUTH_EXPIRED_TOKEN
□ Private route with tampered token → 401 AUTH_INVALID_TOKEN
□ Rate limit: 251st mutation within 30s → 429 SYSTEM_RATE_LIMITED
□ Unknown route → 404
□ Correlation ID: x-trace-id present in response headers
□ Correlation ID: x-trace-id generated if not in request
```

---

## 11. Definition of Done

```
□ All SERVICE_ROUTES proxied correctly
□ Auth verified before every non-public route
□ x-user-id, x-workspace-id, x-role injected in all proxied requests
□ Rate limiting enforced via Redis (works with multiple gateway instances)
□ x-trace-id propagated to all upstream requests
□ pnpm typecheck, lint, test pass
□ Coverage ≥ 80%
```

---

## 12. Constraints

```
✗ Do NOT implement business logic in the gateway
✗ Do NOT call the DB directly — gateway has no DB connection
✗ Do NOT expose the AI service directly to clients (internal only)
✗ Do NOT buffer request bodies (stream them through to services)
```

---

## 13. Allowed Dependencies

```json
{
  "http-proxy-middleware": "^3.0.0",
  "express-rate-limit": "^7.2.0"
}
```
