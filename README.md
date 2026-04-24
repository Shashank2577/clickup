# ClickUp OSS — Project Management Reimagined

An open-source, high-performance project management platform built with a microservices architecture. Designed for speed, scalability, and flexibility.

## 🏗️ Architecture Overview

ClickUp OSS follows a distributed microservices pattern:

- **API Gateway**: The central entry point for all client requests. Handles routing, authentication forwarding, rate limiting, and WebSocket room management.
- **Identity Service**: Manages users, workspaces, authentication (including OAuth/SSO), and permission hierarchies.
- **Task Service**: The core of the platform. Handles task CRUD, custom fields, statuses, templates, and complex task operations (merge, move, etc.).
- **AI Service**: Provides AI-powered capabilities like task breakdown, daily planning, summarization, and doc generation using Anthropic/OpenAI.
- **Docs Service**: Real-time collaborative document editing using Yjs and WebSockets.
- **Comment Service**: Threaded discussions and mentions across tasks and docs.
- **Search Service**: High-performance full-text search and suggestions powered by Elasticsearch.
- **Automations Service**: Event-driven automation engine for trigger-based actions.
- **Notification Service**: Central hub for push, email, and in-app notifications.
- **File Service**: Blob storage management (MinIO/S3 compatible).
- **Views Service**: Dynamic query engine for List, Board, Gantt, and Calendar views.
- **Specialized Services**: Goals, Sprints, Dashboards, and Webhooks.

## 📦 Project Structure

```text
├── packages/
│   ├── contracts/      # Shared Zod schemas and TypeScript types
│   ├── sdk/            # Shared service SDK (logger, errors, auth, events)
│   └── test-helpers/   # Shared testing utilities and fixtures
├── services/
│   ├── api-gateway/    # Entry point & WebSocket bridge
│   ├── identity-service/
│   ├── task-service/
│   └── ... (15+ other services)
└── infra/
    ├── docker-compose.yml  # Local development infrastructure (DB, Redis, NATS)
    └── migrations/         # Shared database migrations
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- [Docker](https://www.docker.com/) & Docker Compose

### Local Development Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Spin up infrastructure**:
   ```bash
   docker-compose -f infra/docker-compose.yml up -d
   ```

3. **Run migrations & seed data**:
   ```bash
   pnpm migrate
   pnpm seed
   ```

4. **Start all services in dev mode**:
   ```bash
   pnpm dev
   ```

## 🧪 Testing

We use a multi-layered testing strategy:
- **Unit Tests**: `vitest` in each service.
- **Integration Tests**: Service-level integration with databases.
- **Contract Tests**: `Pact` for ensuring API compatibility across services.
- **Smoke Tests**: `scripts/smoke-test.sh` for E2E verification.

Run all tests:
```bash
pnpm test
```

## 🛠️ Technology Stack

- **Runtime**: Node.js / TypeScript
- **Web Framework**: Express
- **Database**: PostgreSQL (Prisma/TypeORM/Raw PG depending on service needs)
- **Cache**: Redis
- **Message Bus**: NATS JetStream
- **Search**: Elasticsearch
- **Real-time**: WebSockets (y-websocket for Docs)
- **AI**: Anthropic Claude / OpenAI GPT

## 📄 Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Reference](./docs/API.md)
- [Contributing Guide](./CONTRIBUTING.md)
