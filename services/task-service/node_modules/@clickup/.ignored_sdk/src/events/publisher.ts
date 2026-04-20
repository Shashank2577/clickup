import { connect, type NatsConnection, StringCodec } from 'nats'
import type { EventSubject } from '@clickup/contracts'
import { logger } from '../logging/logger.js'

// ============================================================
// NATS JetStream publisher
// Usage: await publish('task.created', payload)
// ============================================================

let natsConnection: NatsConnection | null = null
const sc = StringCodec()

export async function getNats(): Promise<NatsConnection> {
  if (natsConnection === null) {
    natsConnection = await connect({
      servers: process.env['NATS_URL'] ?? 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    })

    logger.info('Connected to NATS')

    natsConnection.closed().then(() => {
      logger.warn('NATS connection closed')
      natsConnection = null
    }).catch((err) => {
      logger.error({ err }, 'NATS connection error')
    })
  }
  return natsConnection
}

export async function publish(subject: EventSubject, payload: unknown): Promise<void> {
  try {
    const nats = await getNats()
    const js = nats.jetstream()
    await js.publish(subject, sc.encode(JSON.stringify(payload)))
    logger.debug({ subject }, 'Event published')
  } catch (err) {
    // Publishing failures are logged but never crash the service.
    // Downstream services handle eventual consistency.
    logger.error({ err, subject }, 'Failed to publish event')
  }
}
