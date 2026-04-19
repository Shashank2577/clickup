import { subscribe } from '@clickup/sdk'
import { ALL_EVENTS, EmitRules } from '@clickup/contracts'
import type { EventSubject } from '@clickup/contracts'
import type { RoomManager } from './ws.rooms.js'

export async function startNatsBridge(rooms: RoomManager): Promise<void> {
  for (const subject of Object.values(ALL_EVENTS) as EventSubject[]) {
    await subscribe(
      subject,
      async (payload: Record<string, unknown>) => {
        const emitFn = EmitRules[subject as keyof typeof EmitRules]
        if (!emitFn) return
        const targetRooms = (emitFn as (p: unknown) => string[])(payload)
        rooms.emitToRooms(targetRooms, {
          type: 'event',
          subject,
          payload,
          ts: Date.now(),
        })
      },
      { durable: `gw-ws-${subject.replace(/\./g, '-')}` },
    )
  }
}
