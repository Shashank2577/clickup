import { subscribe } from '@clickup/sdk';
import { ALL_EVENTS, EmitRules } from '@clickup/contracts';
export async function startNatsBridge(rooms) {
    for (const subject of Object.values(ALL_EVENTS)) {
        await subscribe(subject, async (payload) => {
            const emitFn = EmitRules[subject];
            if (!emitFn)
                return;
            const targetRooms = emitFn(payload);
            rooms.emitToRooms(targetRooms, {
                type: 'event',
                subject,
                payload,
                ts: Date.now(),
            });
        }, { durable: `gw-ws-${subject.replace(/\./g, '-')}` });
    }
}
//# sourceMappingURL=ws.nats-bridge.js.map