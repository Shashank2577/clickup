# ClickUp OSS Contracts

The source of truth for all data schemas, API contracts, and event types across the platform.

## 🚀 Purpose

- **Type Safety**: Provides TypeScript types for all core entities (Task, Doc, User, etc.).
- **Validation**: Uses Zod for runtime request/response validation.
- **Consistency**: Ensures all microservices agree on data structures and event payloads.
- **Contract Testing**: Forms the basis for Pact consumer-driven contract tests.

## 📦 Structure

- `src/schemas/`: Zod definitions for every resource.
- `src/types/entities.ts`: Derived TypeScript types from Zod schemas.
- `src/types/events.ts`: Exhaustive list of all events emitted via NATS.
- `src/types/enums.ts`: Shared enumerations (Priorities, Roles, Status Groups).

## 🛠️ Usage

### Validation in Express
```typescript
import { TaskSchema } from '@clickup/contracts'

app.post('/tasks', (req, res) => {
  const data = TaskSchema.parse(req.body)
  // data is now typed and validated
})
```

### Type Usage
```typescript
import { Task } from '@clickup/contracts'

const myTask: Task = { ... }
```
