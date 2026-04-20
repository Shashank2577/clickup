import { WebSocket } from 'ws';
export class RoomManager {
    rooms = new Map();
    join(ws, room) {
        if (!this.rooms.has(room))
            this.rooms.set(room, new Set());
        this.rooms.get(room).add(ws);
        ws.rooms.add(room);
    }
    leave(ws, room) {
        this.rooms.get(room)?.delete(ws);
        ws.rooms.delete(room);
    }
    leaveAll(ws) {
        for (const room of ws.rooms) {
            this.leave(ws, room);
        }
    }
    // Fan out with deduplication — client in multiple rooms gets one message
    emitToRooms(rooms, payload) {
        const seen = new Set();
        const message = JSON.stringify(payload);
        for (const room of rooms) {
            for (const ws of this.rooms.get(room) ?? []) {
                if (!seen.has(ws) && ws.readyState === WebSocket.OPEN) {
                    seen.add(ws);
                    ws.send(message);
                }
            }
        }
    }
}
//# sourceMappingURL=ws.rooms.js.map