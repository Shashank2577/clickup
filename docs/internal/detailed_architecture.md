# Internal Detailed Architecture Specification

This document serves as the technical deep dive for engineers developing on ClickUp OSS.

## 🏗️ Core Architecture Principles

ClickUp OSS is designed around a microservices paradigm to isolate domains, allow scaling of specific bottlenecks, and permit independent deployments.

### 1. Database Isolation
- **Pattern**: Database-per-service (logical or physical). Currently, all services connect to the same PostgreSQL cluster, but they use distinct schema or table prefixes.
- **Rule**: Cross-service data fetching *must* occur over HTTP or NATS RPC. Direct database queries across domain boundaries are strictly prohibited.

### 2. Event-Driven Eventual Consistency
- **Pattern**: Outbox Pattern or direct message publishing via NATS JetStream.
- **Implementation**: When `task-service` completes a task, it emits `task.completed`. The `search-service` listens to this event to update the Elasticsearch index, and the `goals-service` listens to update OKR progress.

### 3. API Gateway & Routing
- **Component**: Express + `http-proxy-middleware`.
- **Flow**:
  1. Client calls `POST /api/v1/tasks`.
  2. Gateway receives the request and extracts the `Authorization: Bearer <token>` header.
  3. Gateway calls an internal validation function (or makes an RPC to `identity-service`) to verify the token.
  4. Gateway strips the `/api/v1/tasks` prefix (depending on config) and sets HTTP headers: `x-user-id` and `x-workspace-id`.
  5. Gateway forwards the request to `task-service` at `POST /`.

### 4. Websockets & Real-time
- **Component**: Gateway WS Server + NATS.
- **Flow**:
  1. Client connects to Gateway WS.
  2. Client sends a "join room" message for `task:123`.
  3. When `task-service` updates task 123, it publishes a NATS event `ws.broadcast.task.123`.
  4. Gateway subscribes to `ws.broadcast.*`, receives the message, and fans it out to all WS clients connected to `task:123`.

## 📦 Domain Specifications

### Task Service Deep Dive
- **Table Structure**: `tasks` uses a `path` column (type `ltree` or simple string with GiST indexes) to model the hierarchy: `/workspace_id/space_id/list_id/task_id`.
- **Sequencing**: A fractional indexing approach (e.g., lexical string sorting) is used for reordering tasks. We maintain a `seq_id` which allows O(1) reads for order, and O(1) writes for dragging and dropping between two items (calculating the midpoint string).

### Docs Service Deep Dive
- **CRDT Implementation**: We use `yjs`.
- **Persistence**: We cannot store the full Yjs binary object in PostgreSQL efficiently for every keypress. Instead, we use `y-websocket` backed by a custom provider that batches updates.
- **Snapshots**: Every N minutes, or upon a significant change, we generate a JSON snapshot of the doc and store it in PG for fast initial load and history views.

### Search Service Deep Dive
- **Engine**: Elasticsearch.
- **Indexing**: A background process consumes `*.created`, `*.updated`, `*.deleted` events. It transforms relational data into a flat denormalized document optimized for fast querying.
- **ACLs in Search**: Documents in ES contain arrays of `allowed_user_ids` and `allowed_workspace_ids`. At query time, the user's ID is used as a hard filter.

## 🛡️ Security Posture

- **Service-to-Service**: Internal calls must include an `x-service-token` signed with an internal secret.
- **Rate Limiting**: Enforced at the gateway layer using Redis sliding window algorithms.

## 🧪 Testing Guidelines

1. **Unit Tests**: Must run without external dependencies (no DB, no NATS). Mock everything.
2. **Integration Tests**: Use Testcontainers to spin up PG/Redis/NATS. Hit the service's HTTP endpoints directly.
3. **Pact Tests**: Define the expected JSON contract between `gateway` and `task-service`. Ensures `task-service` doesn't break the `gateway` unexpectedly.
