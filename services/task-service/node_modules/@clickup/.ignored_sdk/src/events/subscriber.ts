import { StringCodec } from 'nats'
import type { EventSubject } from '@clickup/contracts'
import { getNats } from './publisher.js'
import { logger } from '../logging/logger.js'

// ============================================================
// NATS JetStream subscriber
// Usage:
//   await subscribe('task.created', async (payload) => { ... })
// ============================================================

const sc = StringCodec()

export async function subscribe<T>(
  subject: EventSubject,
  handler: (payload: T) => Promise<void>,
  options: { durable?: string; queue?: string } = {},
): Promise<void> {
  const nats = await getNats()
  const js = nats.jetstream()

  const consumerOptions = js.consumers.get
  void consumerOptions // suppress unused warning

  const sub = await js.subscribe(subject, {
    config: {
      durable_name: options.durable,
      deliver_subject: options.queue,
    },
  })

  logger.info({ subject }, 'Subscribed to event')

  void (async () => {
    for await (const msg of sub) {
      try {
        const raw = sc.decode(msg.data)
        const payload = JSON.parse(raw) as T
        await handler(payload)
        msg.ack()
      } catch (err) {
        logger.error({ err, subject }, 'Event handler failed — nacking')
        msg.nak()
      }
    }
  })()
}
