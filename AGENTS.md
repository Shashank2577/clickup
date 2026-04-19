# AGENTS.md — ClickUp OSS

## Project Overview

Open-source ClickUp alternative. AI-native, self-hostable TypeScript microservices
monorepo. Users bring their own Anthropic API key. Built to be deployed on a single
server with Docker Compose.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.4, Node.js ≥20 |
| Runtime | Express 4 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Messaging | NATS JetStream 2.10 |
| Search | ElasticSearch 8.12 |
| File storage | MinIO |
| AI | Anthropic Claude API (user's own key) |
| Package manager | pnpm 9 (workspaces monorepo) |
| Testing | Vitest |
| Linting | ESLint with `@typescript-eslint` |

## Monorepo Structure

```
packages/
  contracts/      — @clickup/contracts: all shared types, Zod schemas, error codes, NATS event subjects, WebSocket rooms
  sdk/            — @clickup/sdk: auth middleware, AppError, logger, cache, NATS publish/subscribe, DataLoader, health handler
  test-helpers/   — @clickup/test-helpers: DB fixtures, JWT factory, request helpers (devDependency only)

services/
  _template/      — copy-paste base for new services
  api-gateway/    — port 3000 — single entry point, JWT validation, proxy routing, WebSocket hub
  identity-service/ — port 3001 — users, auth, workspaces, spaces, lists
  task-service/   — port 3002 — tasks, checklists, relations, custom fields, time tracking
  comment-service/ — port 3003 — comments, reactions, mentions
  docs-service/   — port 3004 — collaborative documents (Y.js)
  ai-service/     — port 3006 — Claude API wrapper, task breakdown, summarization, prioritization, daily planning
  file-service/   — port 3005 — MinIO uploads, presigned download URLs
  notification-service/ — port 3007 — in-app notifications, email
  search-service/ — port 3008 — ElasticSearch full-text search

infra/
  migrations/     — PostgreSQL migration files (001_initial.sql, 002_research_improvements.sql)
  seeds/          — development seed script
  docker-compose.yml — postgres, redis, nats, elasticsearch, minio

.omc/work-orders/ — Jules task specs (read these for what to implement)
```

## CRITICAL: Architecture Rules

**Read these before writing any code. Breaking them causes PR rejection.**

### 1. Contract-First — Never Modify Shared Packages

- `packages/contracts` and `packages/sdk` are **READ ONLY** for all service WOs
- Import types, schemas, error codes, event subjects from `@clickup/contracts`
- Import middleware, AppError, cache, logger, NATS from `@clickup/sdk`
- NEVER add npm packages to contracts or sdk

### 2. Your Work Order Is Your Spec

Each Jules session has a work order in `.omc/work-orders/WO-XXX-*.md`.
**Read it fully before writing any code.** It specifies:
- Exact files to create (do not create others)
- Exact SQL queries to use (copy them verbatim)
- Exact error codes to throw
- Mandatory tests that must pass

### 3. Coding Rules (violations = PR rejected)

```
✗ NEVER use console.log → use logger from @clickup/sdk
✗ NEVER throw raw Error → use AppError(ErrorCode.X) from @clickup/sdk
✗ NEVER write custom validation → use validate(Schema, data) from @clickup/sdk
✗ NEVER write SQL in handler or service files → only in repository files
✗ NEVER use recursive CTEs for task trees → use materialized path LIKE
✗ NEVER call another service's src/ directly → use createServiceClient HTTP
✗ NEVER call the Anthropic API directly → call ai-service via HTTP
✗ NEVER import from packages/contracts/src directly → import from @clickup/contracts
✗ NEVER commit .env files
✗ NEVER modify 001_initial.sql or 002_research_improvements.sql
```

### 4. Service Template

Always start from `services/_template/`:
```bash
cp -r services/_template services/your-service-name
```
Then update `package.json` name and `.env` SERVICE_NAME + PORT.

### 5. Database Schema

The full schema is in `infra/migrations/001_initial.sql` and `002_research_improvements.sql`.
Tables already exist — do NOT run CREATE TABLE. Do NOT add columns or indexes not already in the schema.

Key patterns:
- **Task hierarchy**: materialized path stored in `tasks.path` (format: `/{list_id}/{task_id}/`)
  - Fetch subtree: `WHERE path LIKE $parent_path || '%'`
  - Root task path: `'/' || list_id || '/' || task_id || '/'`
  - Subtask path: `parent.path || task_id || '/'`
- **Human-readable IDs**: `task_sequences` table (MAX(seq_id)+1), displayed as `{list_slug}-{seq_id}`
- **Optimistic locking**: `tasks.version BIGINT` — increment on every update
- **Soft deletes**: `deleted_at TIMESTAMPTZ` — always filter `WHERE deleted_at IS NULL`
- **Custom task statuses**: `task_statuses` table per list, `status_group` enum (backlog/unstarted/started/completed/cancelled)

### 6. Event Publishing

```typescript
// ALWAYS publish AFTER DB write, NEVER inside a transaction
await repository.createTask(task)
await publish(TASK_EVENTS.CREATED, {
  taskId: task.id,
  workspaceId,
  createdBy: req.auth.userId,
  occurredAt: new Date().toISOString(),
} satisfies TaskCreatedEvent)
```

### 7. Testing

- Integration tests use `withRollback()` from `@clickup/test-helpers` for isolation
- Do NOT mock the database in integration tests (mock the repository in unit tests)
- Every test fixture uses `createTestUser`, `createTestWorkspace`, etc. from `@clickup/test-helpers`
- bcrypt cost factor 4 in test fixtures only (never in production code)

## Build & Test

```bash
# Install
pnpm install

# Build all packages
pnpm -r build

# Test a specific service
pnpm --filter @clickup/identity-service test

# Typecheck
pnpm --filter @clickup/identity-service typecheck

# Lint
pnpm --filter @clickup/identity-service lint

# Start all infra (postgres, redis, nats, etc.)
docker-compose up -d

# Run migrations
psql $DATABASE_URL -f infra/migrations/001_initial.sql
psql $DATABASE_URL -f infra/migrations/002_research_improvements.sql
```

## Environment Variables

Every service has a `.env.example`. Copy to `.env` and fill in:

```bash
DATABASE_URL=postgres://clickup:clickup@localhost:5432/clickup_dev
REDIS_HOST=localhost
REDIS_PORT=6379
NATS_URL=nats://localhost:4222
JWT_SECRET=change-me-in-production
SERVICE_NAME=your-service-name
PORT=300X
LOG_LEVEL=info
```

For test runs:
```bash
DATABASE_URL=postgres://clickup:clickup@localhost:5432/clickup_test
```

## Definition of Done (every service)

Before opening a PR, verify ALL:
```
□ pnpm typecheck — zero errors
□ pnpm lint — zero warnings  
□ pnpm test — all tests pass
□ Coverage ≥ 80%
□ GET /health returns 200
□ No console.log in source files
□ No raw Error thrown
□ .env not committed
□ All mandatory tests from the work order pass
```

## Port Map

| Service | Port |
|---------|------|
| api-gateway | 3000 |
| identity-service | 3001 |
| task-service | 3002 |
| comment-service | 3003 |
| docs-service | 3004 |
| file-service | 3005 |
| ai-service | 3006 |
| notification-service | 3007 |
| search-service | 3008 |
