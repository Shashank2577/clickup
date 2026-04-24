# ClickUp OSS Service SDK

A shared library of utilities, middleware, and core logic used by all ClickUp OSS microservices.

## 🚀 Features

- **Standardized Logging**: Structured logging using `pino` with request correlation IDs.
- **Error Handling**: Centralized `AppError` class and Express error-handling middleware.
- **Authentication**: JWT validation and context extraction (User ID, Workspace ID).
- **Service Discovery**: Helpers for resolving internal service URLs.
- **Messaging**: Simplified NATS JetStream publisher/subscriber wrappers.
- **Health Checks**: Standard health-check handler with DB connectivity verification.
- **Caching**: Shared Redis client configurations and patterns.

## 📦 Usage

### Error Handling
```typescript
import { AppError } from '@clickup/sdk'

if (!user) {
  throw new AppError('User not found', 404)
}
```

### Event Publishing
```typescript
import { publisher } from '@clickup/sdk'

await publisher.publish('task.created', { taskId: '123' })
```

### Logging
```typescript
import { logger } from '@clickup/sdk'

logger.info({ taskId }, 'Task processed successfully')
```

## 🛠️ Tech Stack

- **pino**: High-performance logging.
- **ioredis**: Redis client.
- **nats**: NATS client.
- **jsonwebtoken**: JWT utilities.
