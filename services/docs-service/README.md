# Docs Service

Real-time collaborative document editor with CRDT-based synchronization.

## 🚀 Key Features

- **Real-time Collaboration**: Powered by Yjs for seamless, conflict-free multi-user editing.
- **Rich Text Support**: Full formatting, embeds, and structured document schemas.
- **Hierarchical Documents**: Nested pages using materialized paths (Doc -> Child Doc).
- **Version History**: Periodic snapshots with the ability to restore to previous states.
- **Permissions**: 5-tier access model (Workspace, Explicit, Share Link, Public, Deny).

## 🏗️ Technical Architecture

### Conflict Resolution
We use **Yjs**, a high-performance CRDT library. Changes are synced over WebSockets via the API Gateway. The `docs-service` acts as the persistence layer for the Yjs document state.

### Persistence
- **Primary**: PostgreSQL stores the binary update log and the materialized path structure.
- **Snapshots**: JSON snapshots of the document are taken periodically to allow for fast initial loading.

## 🔌 API & WebSockets

- `GET /docs/:id`: Retrieve document metadata and initial state.
- `GET /docs/:id/versions`: List historical snapshots.
- `WebSocket /ws?room=doc:ID`: Real-time update stream (via API Gateway).

## 🛠️ Tech Stack

- **Node.js / Express**
- **Yjs / y-websocket**: CRDT and synchronization.
- **PostgreSQL**: Persistence and snapshotting.
