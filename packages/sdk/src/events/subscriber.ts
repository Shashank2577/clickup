import { StringCodec, AckPolicy } from 'nats'
import type { EventSubject } from '@clickup/contracts'
import { getNats } from './publisher.js'
import { logger } from '../logging/logger.js'

// ============================================================
// NATS JetStream subscriber
// Usage:
//   await subscribe('task.created', async (payload) => { ... })
// ============================================================

const sc = StringCodec()
const STREAM = 'clickup'
// All published subjects are prefixed so the stream subject 'clickup.>'
// never overlaps with NATS internal subjects like $JS.API.*.
const PREFIX = 'clickup.'

export async function subscribe<T>(
  subject: EventSubject,
  handler: (payload: T) => Promise<void>,
  options: { durable?: string; queue?: string } = {},
): Promise<void> {
  const nats = await getNats()
  const js = nats.jetstream()
  const jsm = await nats.jetstreamManager()

  const durable = options.durable || options.queue || 'consumer-' + subject.replace('.', '-')

  // Ensure stream exists — idempotent, safe to call on every boot.
  // 'clickup.>' avoids overlap with $JS.API.* and other NATS internals.
  try {
    await jsm.streams.add({ name: STREAM, subjects: [PREFIX + '>'] })
  } catch (err: any) {
    if (!err.message?.includes('stream name already in use')) {
      throw err
    }
  }

  // Ensure consumer exists
  try {
    await jsm.consumers.add(STREAM, {
      durable_name: durable,
      ack_policy: AckPolicy.Explicit,
      filter_subject: PREFIX + subject,
    })
  } catch (err: any) {
    if (!err.message.includes('already exists')) {
      throw err
    }
  }

  const consumer = await js.consumers.get(STREAM, durable)
  const messages = await consumer.consume()

  logger.info({ subject, durable }, 'Subscribed to event (pull consumer)')

  void (async () => {
    for await (const msg of messages) {
      try {
        const raw = sc.decode(msg.data)
        const payload = JSON.parse(raw) as T
        await handler(payload)
        msg.ack()
      } catch (err) {
        logger.error({ err, subject, durable }, 'Event handler failed — nacking')
        msg.nak()
      }
    }
  })()
}
