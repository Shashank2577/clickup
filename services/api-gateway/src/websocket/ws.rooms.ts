import { WebSocket } from 'ws'

export interface AuthedSocket extends WebSocket {
  userId: string
  workspaceId: string
  rooms: Set<string>
  isAlive: boolean
}

export class RoomManager {
  private rooms: Map<string, Set<AuthedSocket>> = new Map()

  join(ws: AuthedSocket, room: string): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set())
    this.rooms.get(room)!.add(ws)
    ws.rooms.add(room)
  }

  leave(ws: AuthedSocket, room: string): void {
    this.rooms.get(room)?.delete(ws)
    ws.rooms.delete(room)
  }

  leaveAll(ws: AuthedSocket): void {
    for (const room of ws.rooms) {
      this.leave(ws, room)
    }
  }

  // Fan out with deduplication — client in multiple rooms gets one message
  emitToRooms(rooms: string[], payload: unknown): void {
    const seen = new Set<AuthedSocket>()
    const message = JSON.stringify(payload)
    for (const room of rooms) {
      for (const ws of this.rooms.get(room) ?? []) {
        if (!seen.has(ws) && ws.readyState === WebSocket.OPEN) {
          seen.add(ws)
          ws.send(message)
        }
      }
    }
  }
}
