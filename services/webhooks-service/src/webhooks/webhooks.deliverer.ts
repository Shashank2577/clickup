import crypto from 'crypto'
import { Pool } from 'pg'
import { subscribe, logger } from '@clickup/sdk'
import { WebhooksRepository } from './webhooks.repository.js'

// ============================================================
// NATS event subjects the webhook deliverer listens to.
// Mirrors the NATS subjects defined in @clickup/contracts.
// ============================================================
const WEBHOOK_EVENT_SUBJECTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'task.assigned',
  'task.completed',
  'task.status_changed',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'doc.created',
  'doc.updated',
  'doc.deleted',
  'workspace.member_added',
  'workspace.member_removed',
  'goal.created',
  'goal.progress_updated',
  'goal.completed',
  'file.uploaded',
  'file.deleted',
] as const

async function deliverWebhook(
  webhookUrl: string,
  secret: string,
  eventType: string,
  payload: unknown,
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify({
    event: eventType,
    payload,
    deliveredAt: new Date().toISOString(),
  })
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ClickUp-Signature': 'sha256=' + sig,
        'X-ClickUp-Event': eventType,
      },
      body,
      signal: controller.signal,
    })
    const responseBody = await res.text()
    return { status: res.status, body: responseBody.slice(0, 1000) }
  } finally {
    clearTimeout(timeout)
  }
}

export async function startWebhookDeliverer(db: Pool): Promise<void> {
  const repo = new WebhooksRepository(db)

  for (const eventType of WEBHOOK_EVENT_SUBJECTS) {
    await subscribe(
      eventType as any,
      async (payload: any) => {
        // All events include workspaceId in their payload
        const workspaceId = payload?.workspaceId
        if (!workspaceId) return

        const webhooks = await repo.getActiveWebhooksForEvent(workspaceId, eventType)

        for (const webhook of webhooks) {
          const delivery = await repo.createDelivery({
            webhookId: webhook.id,
            eventType,
            payload,
          })

          try {
            const result = await deliverWebhook(webhook.url, webhook.secret, eventType, payload)
            const success = result.status >= 200 && result.status < 300
            await repo.updateDelivery(delivery.id, {
              status: success ? 'success' : 'failed',
              httpStatus: result.status,
              responseBody: result.body,
              deliveredAt: success ? new Date() : null,
              attempts: 1,
            })
          } catch (err: any) {
            logger.error({ err, webhookId: webhook.id, eventType }, 'Webhook delivery failed')
            await repo.updateDelivery(delivery.id, {
              status: 'failed',
              responseBody: err.message?.slice(0, 500),
              attempts: 1,
            })
          }
        }
      },
      { durable: `webhooks-svc-${(eventType as string).replace(/\./g, '-')}` },
    )
  }

  logger.info('Webhook deliverer started — subscribed to %d event types', WEBHOOK_EVENT_SUBJECTS.length)
}
