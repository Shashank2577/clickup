# Pact Contract Testing

Consumer-driven contract testing using [Pact](https://pact.io/).
Each service publishes a pact describing what it expects from its dependencies.
The Pact Broker stores these contracts and CI verifies them on every PR.

## Start the Pact Broker locally

```bash
docker-compose -f infra/pact/docker-compose.pact.yml up -d
# Broker UI: http://localhost:9292  (username: pact, password: pact)
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

## Verify a provider against published pacts

```bash
pnpm --filter @clickup/identity-service test:pact-provider
```

## How it works

```
Consumer (task-service)
  → writes test defining expected contract with identity-service
  → test runs against Pact mock server (no real service needed)
  → generates pact.json file
  → publishes to Pact Broker

Provider (identity-service)
  → runs verification test on every PR
  → starts real service, replays pact interactions
  → CI fails if any consumer contract is broken
```

## Adding a consumer test

```typescript
// services/task-service/tests/contract/identity.consumer.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact'
import path from 'path'

const provider = new PactV3({
  consumer: 'task-service',
  provider: 'identity-service',
  dir: path.resolve('./pacts'),
})

describe('task-service → identity-service', () => {
  it('GET /api/v1/lists/:id returns list shape', () => {
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
              name: MatchersV3.string('My List'),
            },
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/lists/abc123`)
        const body = await res.json()
        expect(body.data.id).toBeDefined()
      })
  })
})
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PACT_BROKER_URL` | `http://localhost:9292` | Broker URL |
| `PACT_BROKER_USERNAME` | `pact` | Basic auth username |
| `PACT_BROKER_PASSWORD` | `pact` | Basic auth password |

> **Never commit credentials** — use environment variables or GitHub Secrets.
