# Docker Compose + Frontend Design

**Date:** 2026-04-27 (updated 2026-04-28)
**Status:** Approved
**Scope:** Containerise all 21 backend microservices, add a Vite+React frontend with Clerk auth (GitHub + Google + Microsoft login + multi-tenancy via Organizations), wire everything through an Nginx reverse proxy, and expose a single port (8080) via one `docker-compose up`.

---

## 1. Architecture

```
Browser
  │
  ▼ :8080
Nginx (reverse proxy)
  │
  ├── /        → frontend container :5173 (Vite+React static build)
  └── /api/*   → api-gateway container :3000 (strips /api prefix)
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
  identity:3001   task:3002   comment:3003  … 18 more services
          │             │
          └─────────────┴──► postgres / redis / nats / elasticsearch / minio
```

**Single exposed port:** `8080` (Nginx).
All other ports are internal to the `clickup-net` Docker network — nothing else is exposed to the host.

---

## 2. Services Inventory

### Infrastructure (5 containers)
| Container | Internal port | Image |
|---|---|---|
| postgres | 5432 | postgres:16-alpine |
| redis | 6379 | redis:7-alpine |
| nats | 4222 | nats:2.10-alpine |
| elasticsearch | 9200 | elasticsearch:8.12.0 |
| minio | 9000 / 9001 | minio/minio:latest |

### Backend (21 containers)
| Container | Internal port | Source |
|---|---|---|
| api-gateway | 3000 | services/api-gateway |
| identity-service | 3001 | services/identity-service |
| task-service | 3002 | services/task-service |
| comment-service | 3003 | services/comment-service |
| notification-service | 3004 | services/notification-service |
| file-service | 3005 | services/file-service |
| ai-service | 3006 | services/ai-service |
| automations-service | 3007 | services/automations-service |
| search-service | 3008 | services/search-service |
| goals-service | 3009 | services/goals-service |
| docs-service | 3010 | services/docs-service |
| views-service | 3011 | services/views-service |
| webhooks-service | 3012 | services/webhooks-service |
| sprint-service | 3013 | services/sprint-service |
| dashboard-service | 3014 | services/dashboard-service |
| slack-service | 3015 | services/slack-service |
| github-integration | 3016 | services/github-integration |
| gitlab-integration | 3017 | services/gitlab-integration |
| chat-service | 3021 | services/chat-service |
| audit-service | 3023 | services/audit-service |
| form-service | 3024 | services/form-service |

### Frontend (1 container)
| Container | Internal port | Source |
|---|---|---|
| frontend | 5173 | apps/web |

### Routing (1 container)
| Container | Exposed port | Image |
|---|---|---|
| nginx | **8080 → 80** | nginx:alpine |

**Total: 28 containers, 1 exposed port.**

---

## 3. Shared Backend Dockerfile

All 21 backend services share the same Dockerfile pattern. A single `Dockerfile.service` lives at the repo root and is referenced by each service via build context + args:

```dockerfile
# Dockerfile.service
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/
RUN pnpm install --frozen-lockfile --filter @clickup/${SERVICE_NAME}...
RUN pnpm --filter @clickup/${SERVICE_NAME} build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/${SERVICE_NAME}/dist/ ./services/${SERVICE_NAME}/dist/
COPY --from=builder /app/services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/
RUN pnpm install --frozen-lockfile --prod --filter @clickup/${SERVICE_NAME}...
WORKDIR /app/services/${SERVICE_NAME}
CMD ["node", "dist/index.js"]
```

Each service in docker-compose uses:
```yaml
build:
  context: .
  dockerfile: Dockerfile.service
  args:
    SERVICE_NAME: identity-service
```

---

## 4. Frontend Dockerfile

Multi-stage build — Node only in the builder stage; final image is pure nginx:alpine (~25MB).

```
apps/web/Dockerfile

Stage 1 (builder): node:20-alpine
  - pnpm install
  - pnpm build  →  dist/

Stage 2 (runtime): nginx:alpine
  - COPY dist/ → /usr/share/nginx/html
  - COPY nginx-spa.conf → /etc/nginx/conf.d/default.conf
  - No Node.js, no node_modules in final image
```

`nginx-spa.conf` serves the SPA with `try_files $uri /index.html` so React Router deep links work.

**Environment at build time:**
- `VITE_API_BASE=/api` — all fetch calls use relative paths, no hardcoded host

---

## 5. Nginx Reverse Proxy Config

File: `nginx/nginx.conf`

```nginx
upstream api_gateway {
    server api-gateway:3000;
}

upstream frontend {
    server frontend:5173;
}

server {
    listen 80;

    # Strip /api prefix, forward to api-gateway
    location /api/ {
        proxy_pass http://api_gateway/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Pass cookies through (required for httpOnly auth cookies)
        proxy_pass_header Set-Cookie;
        proxy_pass_header Cookie;
    }

    # All other traffic → React SPA
    location / {
        proxy_pass http://frontend/;
        proxy_set_header Host $host;
    }
}
```

---

## 6. Authentication: Clerk

**Provider:** [Clerk](https://clerk.com) — managed SaaS auth with GitHub, Google, and Microsoft social login plus multi-tenancy via Clerk Organizations. 10,000 MAU free tier.

**No custom auth logic in identity-service.** Clerk owns the full auth lifecycle.

### How it works

```
Browser
  │
  ├── Clerk <SignIn> component (hosted by Clerk JS)
  │     └── OAuth → GitHub / Google / Microsoft
  │           └── Clerk issues session JWT (httpOnly cookie, set by Clerk)
  │
  └── All API requests include Clerk session cookie automatically
        │
        ▼
      Nginx → api-gateway
                │
                └── Clerk backend SDK verifies JWT on every request
                      └── Extracts userId + orgId → passes as headers to services
```

### Keys (environment variables)
| Variable | Where | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend build arg | Public key, safe to expose |
| `CLERK_SECRET_KEY` | api-gateway `.env` | Server-side only, never sent to browser |
| `CLERK_WEBHOOK_SECRET` | identity-service `.env` | Validates Clerk webhook payloads |

### Tenancy via Clerk Organizations
- Each ClickUp **workspace** maps 1:1 to a **Clerk Organization**
- Users join an org → Clerk handles invitations, roles (admin/member)
- `orgId` flows through every JWT claim → api-gateway extracts and forwards as `X-Org-Id` header
- Backend services use `X-Org-Id` for data isolation (replaces `workspace_id` checks)

### Identity-service role (updated)
The identity-service **no longer handles login or JWT issuance**. Its new responsibilities:
1. **User sync** — listens to Clerk webhooks (`user.created`, `user.updated`, `user.deleted`) and mirrors user records into Postgres `users` table
2. **Org sync** — listens to `organization.created` / `organizationMembership.*` webhooks, syncs to `workspaces` + `workspace_members` tables
3. **Internal user lookup** — maps Clerk `userId` → internal UUID for foreign keys in other services

Webhook endpoint: `POST /api/webhooks/clerk` (Nginx routes to identity-service, verified via `svix` signature)

### Auth flow summary
1. User hits `http://localhost:8080` → React app loads Clerk JS
2. Unauthenticated → Clerk `<SignIn>` shown (GitHub / Google / Microsoft buttons)
3. OAuth completes → Clerk sets `httpOnly` session cookie (JS-inaccessible)
4. React app redirects to dashboard
5. All `fetch('/api/...')` calls include cookie automatically
6. api-gateway verifies Clerk JWT on every request, rejects 401 if invalid
7. Logout → `clerk.signOut()` → Clerk clears cookie server-side

---

## 7. Frontend App (apps/web)

**Stack:** Vite + React + TypeScript + TailwindCSS + `@clerk/clerk-react`

**Pages (minimum viable):**
- `/sign-in` — Clerk `<SignIn>` component (GitHub / Google / Microsoft buttons, no custom form)
- `/` — dashboard shell with sidebar (workspaces/orgs, spaces, lists) — guarded by `<SignedIn>`
- `/list/:listId` — task list view

**Clerk React integration:**
```tsx
// main.tsx
<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <App />
</ClerkProvider>
```
- `<SignedIn>` / `<SignedOut>` for route guards
- `useOrganization()` for active workspace/tenant
- `<UserButton>` for profile + org switcher in sidebar
- No manual token handling — Clerk manages session cookies

**API layer:** thin `fetch` wrapper that calls `/api/*` relative URLs — works locally (`pnpm dev` proxies to localhost:3000) and in Docker (Nginx proxies to api-gateway). Clerk session cookie included automatically by browser.

**Local dev (no Docker):**
```bash
cd apps/web && pnpm dev   # Vite dev server on :5173
# vite.config.ts proxies /api → http://localhost:3000
# VITE_CLERK_PUBLISHABLE_KEY set in apps/web/.env.local
```

---

## 8. Docker Compose Structure

Single file: `docker-compose.yml` at repo root replaces `infra/docker-compose.yml`.

```
docker-compose.yml
├── networks: clickup-net
├── volumes: postgres_data, redis_data, nats_data, elastic_data, minio_data
├── services:
│   ├── postgres, redis, nats, elasticsearch, minio  (infrastructure)
│   ├── identity-service ... audit-service            (21 backend services)
│   │     depends_on: [postgres, redis, nats]
│   │     env_file: services/<name>/.env
│   ├── frontend                                       (Vite+React)
│   └── nginx                                          (port 8080, depends_on: frontend, api-gateway)
```

Backend services each use `env_file` pointing to their existing `.env`, with one override: upstream URLs use container names (`http://identity-service:3001`) not localhost.

**Startup command:**
```bash
docker-compose up --build
```

---

## 9. File Changes Summary

| Action | Path |
|---|---|
| Create | `apps/web/` (Vite+React app) |
| Create | `apps/web/Dockerfile` |
| Create | `apps/web/nginx-spa.conf` |
| Create | `apps/web/.env.local` (gitignored — `VITE_CLERK_PUBLISHABLE_KEY`) |
| Create | `Dockerfile.service` (shared backend Dockerfile) |
| Create | `nginx/nginx.conf` |
| Replace | `docker-compose.yml` (was `infra/docker-compose.yml`) |
| Update | `services/api-gateway/.env` — add `CLERK_SECRET_KEY` |
| Update | `services/identity-service/.env` — add `CLERK_WEBHOOK_SECRET` |
| Update | `services/api-gateway/src/` — replace JWT verify with Clerk SDK verify |
| Update | `services/identity-service/src/` — replace auth handlers with Clerk webhook sync handlers |
| Update | Each service `.env` — localhost URLs → container name URLs |

---

## 10. What Is Explicitly Out of Scope

- Hot-reload in Docker (dev runs locally via `pnpm dev`)
- SSL/TLS (add later via Nginx + certbot)
- Docker Swarm / Kubernetes
- CI/CD pipeline changes
- Any new backend feature or API endpoint
