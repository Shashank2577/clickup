# Work Order — Pact Broker Setup
**Wave:** 1
**Session ID:** WO-008
**Depends on:** WO-000 (foundation)
**Branch name:** `wave1/pact-broker`
**Estimated time:** 1 hour

---

## 1. Mission

Set up consumer-driven contract testing infrastructure using Pact. Each service
publishes a "pact" (the API contract it expects from its dependencies). The Pact
Broker stores and verifies these contracts so that any service change that breaks
a dependent service is caught in CI before merge — not in production.

This is a pure infrastructure WO: Docker setup, CI integration, and a shared
`contract-validator` helper. No business logic.

---

## 2. Context

```
Consumer Service (e.g. task-service)
  → writes pact file (what it expects from identity-service)
  → publishes to Pact Broker

Provider Service (e.g. identity-service)
  → verifies against published pacts on every PR
  → CI fails if a published pact is broken

Pact Broker (Docker)
  ← stores pacts
  ← serves pact verification results
  → accessible at http://localhost:9292 in dev
```

---

## 3. Files to Create

```
infra/pact/
├── docker-compose.pact.yml     [Pact Broker + postgres sidecar]
├── README.md                   [How to run pact tests locally]

packages/test-helpers/src/
└── contract-validator.ts       [validateResponse() helper for integration tests]

.github/workflows/
└── pact.yml                    [CI workflow: publish + verify pacts]
```

---

## 4. Dependencies

Add to `packages/test-helpers/package.json`:
```bash
pnpm add -D @pact-foundation/pact @pact-foundation/pact-node
```

---

## 5. Implementation

### 5.1 Pact Broker Docker Compose

```yaml
# infra/pact/docker-compose.pact.yml
version: '3.9'

services:
  pact-broker:
    image: pactfoundation/pact-broker:latest
    ports:
      - '9292:9292'
    environment:
      PACT_BROKER_DATABASE_URL: postgres://pact:pact@pact-db:5432/pact
      PACT_BROKER_LOG_LEVEL: INFO
      PACT_BROKER_BASIC_AUTH_USERNAME: pact
      PACT_BROKER_BASIC_AUTH_PASSWORD: pact
    depends_on:
      pact-db:
        condition: service_healthy

  pact-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pact
      POSTGRES_USER: pact
      POSTGRES_PASSWORD: pact
    volumes:
      - pact_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pact']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pact_db_data:
```

### 5.2 Contract Validator Helper

```typescript
// packages/test-helpers/src/contract-validator.ts
// Validates API responses match the expected contract shape defined in @clickup/contracts
// Used in integration tests: expect(validateResponse('task', body)).toBe(true)

import {
  Task, User, Workspace, WorkspaceMember,
  Space, List, Comment, Doc, Notification,
  PaginatedResponse,
} from '@clickup/contracts'
import { ZodTypeAny, z } from 'zod'

// Minimal validators — enough to catch missing/wrong-type fields
const validators: Record<string, ZodTypeAny> = {
  task: z.object({
    id: z.string().uuid(),
    listId: z.string().uuid(),
    title: z.string(),
    priority: z.string(),
    createdBy: z.string().uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),

  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string(),
  }),

  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    ownerId: z.string().uuid(),
  }),

  workspaceMember: z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.string(),
    joinedAt: z.string(),
  }),

  space: z.object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    name: z.string(),
  }),

  list: z.object({
    id: z.string().uuid(),
    spaceId: z.string().uuid(),
    name: z.string(),
  }),

  comment: z.object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    body: z.string(),
    authorId: z.string().uuid(),
  }),

  notification: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    type: z.string(),
    isRead: z.boolean(),
  }),
}

/**
 * Validates that a response body matches the expected contract shape.
 * Used in integration tests to catch contract drift.
 *
 * @param entityType - The entity name from the validators map above
 * @param data - The parsed response body (.data field)
 * @returns true if valid, throws with detailed error if invalid
 */
export function validateResponse(entityType: string, data: unknown): boolean {
  const validator = validators[entityType]
  if (!validator) throw new Error(`No validator registered for entity type: "${entityType}"`)

  const result = validator.safeParse(data)
  if (!result.success) {
    throw new Error(
      `Contract violation for "${entityType}":\n${result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`
    )
  }
  return true
}

/**
 * Validates a paginated response.
 */
export function validatePaginatedResponse(entityType: string, data: unknown): boolean {
  const itemValidator = validators[entityType]
  if (!itemValidator) throw new Error(`No validator for: "${entityType}"`)

  const paginatedSchema = z.object({
    items: z.array(itemValidator),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })

  const result = paginatedSchema.safeParse(data)
  if (!result.success) {
    throw new Error(
      `Paginated contract violation for "${entityType}":\n${result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`
    )
  }
  return true
}
```

### 5.3 CI Workflow

```yaml
# .github/workflows/pact.yml
name: Contract Tests

on:
  push:
    branches: [main, 'wave*/**']
  pull_request:

jobs:
  # Step 1: Run consumer pact tests — generate pact files
  consumer-pacts:
    name: Consumer Pacts
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - task-service
          - comment-service
          - docs-service
          - ai-service
          - notification-service
          - search-service
          - file-service
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @clickup/${{ matrix.service }} test:contract
        env:
          PACT_BROKER_URL: http://localhost:9292
          PACT_BROKER_USERNAME: pact
          PACT_BROKER_PASSWORD: pact

      - name: Publish pacts to broker
        run: |
          cd services/${{ matrix.service }}
          pnpm pact-broker publish ./pacts \
            --broker-base-url ${{ secrets.PACT_BROKER_URL || 'http://localhost:9292' }} \
            --broker-username pact \
            --broker-password pact \
            --consumer-app-version ${{ github.sha }} \
            --tag ${{ github.ref_name }}

  # Step 2: Run provider verification — verify pacts against real running services
  provider-verification:
    name: Provider Verification
    needs: consumer-pacts
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: clickup_test
          POSTGRES_USER: clickup
          POSTGRES_PASSWORD: clickup
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
      nats:
        image: nats:2.10-alpine
        options: '--health-cmd "nats-server --help" --health-interval 5s'

    strategy:
      matrix:
        provider:
          - identity-service
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @clickup/${{ matrix.provider }} test:pact-provider
        env:
          DATABASE_URL: postgres://clickup:clickup@localhost:5432/clickup_test
          REDIS_HOST: localhost
          NATS_URL: nats://localhost:4222
          JWT_SECRET: test-secret
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL || 'http://localhost:9292' }}
          PACT_BROKER_USERNAME: pact
          PACT_BROKER_PASSWORD: pact
          PACT_PROVIDER_VERSION: ${{ github.sha }}
          PACT_PROVIDER_BRANCH: ${{ github.ref_name }}
```

### 5.4 README

```markdown
<!-- infra/pact/README.md -->
# Pact Contract Testing

## Start the Pact Broker locally

```bash
docker-compose -f infra/pact/docker-compose.pact.yml up -d
# Broker UI: http://localhost:9292 (pact / pact)
```

## Run consumer pact tests (generates pact files)

```bash
pnpm --filter @clickup/task-service test:contract
```

## Publish pacts to broker

```bash
pnpm pact-broker publish ./services/task-service/pacts \
  --broker-base-url http://localhost:9292 \
  --broker-username pact \
  --broker-password pact \
  --consumer-app-version local-dev \
  --tag dev
```

## Verify provider against published pacts

```bash
pnpm --filter @clickup/identity-service test:pact-provider
```

## How contract tests work

1. A **consumer** (e.g. task-service) writes a test that defines what it expects
   from a provider (e.g. identity-service `GET /api/v1/lists/:id`).
2. The consumer test runs against a Pact mock server — no real service needed.
3. This generates a `.json` pact file describing the contract.
4. The pact is published to the Pact Broker.
5. The **provider** (identity-service) runs a verification test that starts the
   real service and replays the pact interactions against it.
6. CI fails if the provider breaks any published consumer contract.

## Adding a new consumer test

```typescript
// services/task-service/tests/contract/identity.consumer.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact'
import { createServiceClient } from '@clickup/sdk'

const provider = new PactV3({
  consumer: 'task-service',
  provider: 'identity-service',
  dir: path.resolve('./pacts'),
})

describe('task-service → identity-service contract', () => {
  it('GET /api/v1/lists/:id returns list with workspaceId', () => {
    return provider
      .addInteraction({
        states: [{ description: 'list abc123 exists' }],
        uponReceiving: 'a request for list abc123',
        withRequest: { method: 'GET', path: '/api/v1/lists/abc123' },
        willRespondWith: {
          status: 200,
          body: {
            data: {
              id: MatchersV3.uuid(),
              spaceId: MatchersV3.uuid(),
              workspaceId: MatchersV3.uuid(),
              name: MatchersV3.string('My List'),
            },
          },
        },
      })
      .executeTest(async (mockServer) => {
        const client = createServiceClient(mockServer.url, { traceId: 'test' })
        const { data } = await client.get('/api/v1/lists/abc123')
        expect(data.workspaceId).toBeDefined()
      })
  })
})
```
```

---

## 6. Mandatory Tests

```
□ docker-compose -f infra/pact/docker-compose.pact.yml up → Pact Broker starts, UI accessible at :9292
□ validateResponse('task', validTask) → returns true
□ validateResponse('task', { id: 'not-a-uuid' }) → throws with field-level error
□ validateResponse('unknown-entity', {}) → throws "No validator registered for..."
□ validatePaginatedResponse('task', { items: [], total: 0, page: 1, limit: 20 }) → returns true
□ CI pact.yml workflow syntax is valid (yamllint)
```

---

## 7. Definition of Done

```
□ docker-compose -f infra/pact/docker-compose.pact.yml up works
□ validateResponse / validatePaginatedResponse exported from packages/test-helpers
□ pact.yml CI workflow committed
□ README explains how to run locally
□ pnpm typecheck passes in packages/test-helpers
```

---

## 8. Constraints

```
✗ Do NOT run real pact verification in unit tests — only validate the helper functions
✗ Do NOT hardcode the Pact Broker URL — use environment variables
✗ Do NOT store pact credentials in committed files
✗ Do NOT add pact as a runtime dependency — devDependency only
```
