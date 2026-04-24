# Architecture Overview

ClickUp OSS is built as a highly modular, event-driven microservices platform. This document describes the system architecture, data flow, and key design decisions.

## 🏗️ System Components

### 1. API Gateway (`services/api-gateway`)
The **API Gateway** is the single entry point for all traffic. Its responsibilities include:
- **Routing**: Mapping `/api/v1/:service/*` to the correct upstream microservice.
- **Authentication Forwarding**: Validating JWTs and injecting `x-user-id` and `x-workspace-id` headers for downstream services.
- **Rate Limiting**: Using Redis to track and limit requests per user/IP.
- **WebSocket Bridge**: Managing real-time connections, room occupancy, and bridging WebSocket events to the NATS message bus.

### 2. Identity & Access Management (`services/identity-service`)
The source of truth for all users and organizational structures.
- **Hierarchical Auth**: Supports Workspace -> Space -> Folder -> List permissions.
- **Unified Login**: Handles password-based auth, OAuth (Google/GitHub), and SSO.
- **Service Tokens**: Issues and validates scoped tokens for inter-service communication.

### 3. Task Management (`services/task-service`)
The heart of the application, managing the complex state of tasks.
- **Path-based Hierarchy**: Tasks use materialized paths for fast recursive queries (e.g., getting all tasks in a Space).
- **Sequencing**: Handles custom task ordering (lexicographical) within lists.
- **Custom Fields**: Flexible schema for user-defined task metadata.

### 4. AI Engine (`services/ai-service`)
Provides intelligent features via LLMs.
- **Capability Handlers**: Specialized modules for Summarization, Daily Planning, and Task Breakdown.
- **Prompt Engineering**: Centralized prompt management with versioning.
- **Context Extraction**: Aggregates data from Task, Doc, and Comment services to provide relevant AI responses.

### 5. Docs & Collaboration (`services/docs-service`)
Built for high-concurrency real-time editing.
- **Conflict Resolution**: Uses Yjs (CRDT) for seamless collaborative editing.
- **Snapshotting**: Periodic persistence of document state to PostgreSQL.
- **Materialized Paths**: Similar to Tasks, allowing Docs to be nested inside Folders or Lists.

## 📡 Communication Patterns

### Synchronous (REST/HTTP)
Used for user-facing actions where immediate feedback is required (e.g., creating a task, logging in).

### Asynchronous (NATS JetStream)
Used for side effects and eventual consistency.
- **Events**: Services emit events like `task.created`, `doc.updated`, `user.invited`.
- **Subscribers**: The Notification service listens for these to send alerts; the Search service listens to re-index data.

### Real-time (WebSockets)
Managed by the API Gateway and Docs service for collaborative features and live UI updates.

## 🗄️ Data Strategy

- **Database per Service**: Each microservice owns its schema in a shared PostgreSQL cluster (logical isolation).
- **Materialized Paths**: Heavily used in Task and Docs for efficient tree traversals.
- **Cache (Redis)**: Used for session storage, rate limiting, and frequent lookups (e.g., permission checks).
- **Search (Elasticsearch)**: Asynchronous indexing of tasks and documents for sub-second global search.

## 🛡️ Security

- **JWT Authentication**: Stateless authentication with short-lived tokens.
- **Permission Middleware**: Shared SDK logic for validating user access to specific resources.
- **Pact Testing**: Consumer-driven contract testing to ensure breaking changes are caught before deployment.
