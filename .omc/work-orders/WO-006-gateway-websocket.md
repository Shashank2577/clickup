# Work Order — API Gateway: WebSocket Hub
**Wave:** 1
**Session ID:** WO-006
**Depends on:** WO-005 (gateway routing must be merged first)
**Branch name:** `wave1/gateway-websocket`
**Estimated time:** 2 hours

---

## 1. Mission

Implement the WebSocket server inside the API gateway. Clients connect here
for real-time updates. The gateway subscribes to NATS events and fans them
out to connected clients in the correct rooms. This is the only place
clients maintain a WebSocket connection.

---

## 2. Context

```
Client → WS ws://gateway:3000/ws → API Gateway WebSocket Hub
                                      ↑
                           NATS JetStream (all event subjects)
                                      ↑
                    task-service, comment-service, etc. (publish events)

Rooms (from @clickup/contracts rooms.ts):
  workspace:{id}  — workspace-level events
  list:{id}       — list-level task events
  task:{id}       — task detail events
  user:{id}       — personal notifications
```

---

## 3. Files to Create

```
services/api-gateway/src/
└── websocket/
    ├── ws.server.ts          [WebSocket server setup]
    ├── ws.auth.ts            [auth on WS handshake]
    ├── ws.rooms.ts           [room join/leave/emit]
    └── ws.nats-bridge.ts     [NATS → WebSocket fan-out]
```

---

## 4. Dependencies

```bash
pnpm add ws
pnpm add -D @types/ws
```

---

## 5. Implementation

### 5.1 WebSocket Server

```typescript
// ws.server.ts
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { verifyWsAuth } from './ws.auth.js'
import { RoomManager } from './ws.rooms.js'
import { startNatsBridge } from './ws.nats-bridge.js'

interface AuthedWebSocket extends WebSocket {
  userId: string
  workspaceId: string
  rooms: Set<string>
  isAlive: boolean
}

export function createWsServer(server: import('http').Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })
  const roomManager = new RoomManager()

  // Start NATS → WebSocket bridge
  void startNatsBridge(roomManager)

  // Heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthedWebSocket
      if (!client.isAlive) { client.terminate(); return }
      client.isAlive = false
      client.ping()
    })
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))

  wss.on('connection', async (ws: AuthedWebSocket, req: IncomingMessage) => {
    // 1. Auth handshake
    const auth = await verifyWsAuth(req)
    if (!auth) { ws.close(4001, 'Unauthorized'); return }

    ws.userId = auth.userId
    ws.workspaceId = auth.workspaceId
    ws.rooms = new Set()
    ws.isAlive = true

    // 2. Auto-join user's personal room
    roomManager.join(ws, `user:${auth.userId}`)
    // Auto-join workspace room
    roomManager.join(ws, `workspace:${auth.workspaceId}`)

    ws.on('pong', () => { ws.isAlive = true })

    // 3. Handle client messages
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WsClientMessage
        handleClientMessage(ws, msg, roomManager)
      } catch {
        // Ignore malformed messages
      }
    })

    ws.on('close', () => {
      roomManager.leaveAll(ws)
    })

    // 4. Send connection acknowledgment
    ws.send(JSON.stringify({ type: 'connected', userId: auth.userId }))
  })
}

interface WsClientMessage {
  type: 'join' | 'leave'
  room: string
}

function handleClientMessage(
  ws: AuthedWebSocket,
  msg: WsClientMessage,
  rooms: RoomManager,
): void {
  // Validate room format — clients can only join rooms for their workspace
  const validRoomPrefixes = ['list:', 'task:']

  if (msg.type === 'join' && validRoomPrefixes.some(p => msg.room.startsWith(p))) {
    rooms.join(ws, msg.room)
    ws.send(JSON.stringify({ type: 'joined', room: msg.room }))
  }

  if (msg.type === 'leave') {
    rooms.leave(ws, msg.room)
  }
}
```

### 5.2 Room Manager

```typescript
// ws.rooms.ts
export class RoomManager {
  private rooms: Map<string, Set<AuthedWebSocket>> = new Map()

  join(ws: AuthedWebSocket, room: string): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set())
    this.rooms.get(room)!.add(ws)
    ws.rooms.add(room)
  }

  leave(ws: AuthedWebSocket, room: string): void {
    this.rooms.get(room)?.delete(ws)
    ws.rooms.delete(room)
  }

  leaveAll(ws: AuthedWebSocket): void {
    ws.rooms.forEach(room => this.leave(ws, room))
  }

  emit(room: string, payload: unknown): void {
    const clients = this.rooms.get(room) ?? new Set()
    const message = JSON.stringify(payload)
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  }

  emitToRooms(rooms: string[], payload: unknown): void {
    // Deduplicate — a client in multiple rooms only gets one message
    const seen = new Set<AuthedWebSocket>()
    const message = JSON.stringify(payload)
    rooms.forEach(room => {
      (this.rooms.get(room) ?? new Set()).forEach(ws => {
        if (!seen.has(ws) && ws.readyState === WebSocket.OPEN) {
          seen.add(ws)
          ws.send(message)
        }
      })
    })
  }
}
```

### 5.3 NATS → WebSocket Bridge

```typescript
// ws.nats-bridge.ts
// Subscribes to ALL NATS events and fans out to correct WS rooms

import { subscribe } from '@clickup/sdk'
import { ALL_EVENTS, EmitRules } from '@clickup/contracts'

export async function startNatsBridge(rooms: RoomManager): Promise<void> {
  // Subscribe to every event subject
  for (const subject of Object.values(ALL_EVENTS)) {
    await subscribe(subject, async (payload: Record<string, unknown>) => {
      // Look up which rooms this event targets
      const emitFn = EmitRules[subject as keyof typeof EmitRules]
      if (!emitFn) return

      const targetRooms = (emitFn as (p: unknown) => string[])(payload)

      // Fan out to all connected clients in those rooms
      rooms.emitToRooms(targetRooms, {
        type: 'event',
        subject,
        payload,
        ts: Date.now(),
      })
    }, { durable: `gateway-ws-${subject.replace(/\./g, '-')}` })
  }
}
```

### 5.4 WS Auth

```typescript
// ws.auth.ts
// Verify JWT from query param or Authorization header on WS upgrade
import jwt from 'jsonwebtoken'
import { AppError, ErrorCode } from '@clickup/sdk'

export async function verifyWsAuth(
  req: IncomingMessage,
): Promise<{ userId: string; workspaceId: string } | null> {
  const url = new URL(req.url ?? '/', `http://localhost`)
  const token = url.searchParams.get('token')
    ?? req.headers.authorization?.slice(7)

  if (!token) return null

  try {
    const secret = process.env['JWT_SECRET']!
    const payload = jwt.verify(token, secret) as { userId: string; workspaceId: string }
    return { userId: payload.userId, workspaceId: payload.workspaceId }
  } catch {
    return null
  }
}
```

---

## 6. Client Protocol

Document this for frontend work orders:

```typescript
// Client connects:
const ws = new WebSocket('ws://localhost:3000/ws?token=<jwt>')

// Server sends on connect:
// { type: 'connected', userId: '...' }

// Client joins a room when opening a list:
ws.send(JSON.stringify({ type: 'join', room: 'list:abc123' }))

// Client receives real-time events:
// { type: 'event', subject: 'task.created', payload: { taskId, ... }, ts: 1234567890 }

// Client leaves room when closing view:
ws.send(JSON.stringify({ type: 'leave', room: 'list:abc123' }))

// Reconnect: on close, reconnect after 2s delay
// Suppress error UI for first 2000ms after reconnect (Huly lesson)
```

---

## 7. Mandatory Tests

### Integration Tests
```
□ WS connect with valid token → receives 'connected' message
□ WS connect with no token → closes with code 4001
□ WS connect with invalid token → closes with code 4001
□ WS join valid room (list:*) → receives 'joined' confirmation
□ WS join invalid room (workspace:other-workspace-id) — reject? (nice to have)
□ NATS event published → connected client in correct room receives it
□ NATS event published → client NOT in room does not receive it
□ Client disconnect → removed from all rooms
□ Heartbeat: dead connection detected + terminated within 60s
□ Deduplication: client in both list:X and task:Y rooms receives task.updated only once
```

---

## 8. Definition of Done

```
□ Clients auto-join workspace:{id} and user:{id} rooms on connect
□ Clients can join list:{id} and task:{id} rooms on demand
□ All NATS events bridged to correct WS rooms (using EmitRules from contracts)
□ Dead connections cleaned up via heartbeat
□ Message deduplication works (client in multiple target rooms gets one message)
□ pnpm typecheck, lint, test pass
□ Coverage ≥ 70% (WS is hard to fully test)
```

---

## 9. Constraints

```
✗ Do NOT implement application logic here — only routing/fanout
✗ Do NOT let clients join arbitrary rooms — validate room prefixes
✗ Do NOT store WS state in Redis yet (single gateway instance for now)
✗ Do NOT use socket.io — use native ws package (lighter, simpler)
```
