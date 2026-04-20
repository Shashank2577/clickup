import { WebSocket } from 'ws';
export interface AuthedSocket extends WebSocket {
    userId: string;
    workspaceId: string;
    rooms: Set<string>;
    isAlive: boolean;
}
export declare class RoomManager {
    private rooms;
    join(ws: AuthedSocket, room: string): void;
    leave(ws: AuthedSocket, room: string): void;
    leaveAll(ws: AuthedSocket): void;
    emitToRooms(rooms: string[], payload: unknown): void;
}
//# sourceMappingURL=ws.rooms.d.ts.map