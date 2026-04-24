# API Gateway Service

The central entry point for the ClickUp OSS microservices architecture.

## 🚀 Responsibilities

- **Unified Routing**: Forwards requests to appropriate upstream services based on path prefixes.
- **Authentication**: Validates JWT tokens and forwards user/workspace context via headers.
- **Real-time Engine**: Handles WebSocket connections and bridges them with the NATS message bus.
- **Rate Limiting**: Protects upstream services using Redis-based rate limiting.
- **Health Monitoring**: Aggregates health status from all upstream services.

## 🛠️ Tech Stack

- **Express**: Web framework.
- **http-proxy-middleware**: For robust request forwarding.
- **ws**: WebSocket server implementation.
- **Redis**: For rate limiting and session tracking.
- **NATS**: For real-time event bridging.

## 📡 WebSocket API

The gateway supports real-time communication via WebSockets.
Clients can join "rooms" (e.g., `task:ID`, `doc:ID`) to receive live updates.

### Connection
```
ws://localhost:3000/ws?token=YOUR_JWT_TOKEN
```

### Joining a Room
```json
{ "type": "join", "room": "task:123" }
```

## 🚦 Configuration

Refer to `.env.example` for required environment variables.
Major routes are configured in `src/proxy/proxy.config.ts`.
