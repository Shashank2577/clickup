import { WebSocketServer } from 'ws';
import { verifyWsAuth } from './ws.auth.js';
import { RoomManager } from './ws.rooms.js';
import { startNatsBridge } from './ws.nats-bridge.js';
const VALID_JOIN_PREFIXES = ['list:', 'task:'];
export function createWsServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    const rooms = new RoomManager();
    void startNatsBridge(rooms);
    // Heartbeat — detect dead connections every 30s
    const heartbeat = setInterval(() => {
        for (const ws of wss.clients) {
            const client = ws;
            if (!client.isAlive) {
                client.terminate();
                continue;
            }
            client.isAlive = false;
            client.ping();
        }
    }, 30_000);
    wss.on('close', () => clearInterval(heartbeat));
    wss.on('connection', (ws, req) => {
        const client = ws;
        const auth = verifyWsAuth(req);
        if (!auth) {
            client.close(4001, 'Unauthorized');
            return;
        }
        client.userId = auth.userId;
        client.workspaceId = auth.workspaceId;
        client.rooms = new Set();
        client.isAlive = true;
        // Auto-join personal and workspace rooms
        rooms.join(client, `user:${auth.userId}`);
        rooms.join(client, `workspace:${auth.workspaceId}`);
        client.on('pong', () => {
            client.isAlive = true;
        });
        client.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'join' && VALID_JOIN_PREFIXES.some((p) => msg.room.startsWith(p))) {
                    rooms.join(client, msg.room);
                    client.send(JSON.stringify({ type: 'joined', room: msg.room }));
                }
                else if (msg.type === 'leave') {
                    rooms.leave(client, msg.room);
                }
            }
            catch {
                // Ignore malformed messages
            }
        });
        client.on('close', () => {
            rooms.leaveAll(client);
        });
        client.send(JSON.stringify({ type: 'connected', userId: auth.userId }));
    });
}
//# sourceMappingURL=ws.server.js.map