import crypto from 'crypto'
import { Request, Response } from 'express'
import { Pool } from 'pg'
import { asyncHandler, requireAuth, validate, AppError } from '@clickup/sdk'
import pkg from '@clickup/contracts'
const { CreateWebhookSchema, UpdateWebhookSchema, ErrorCode } = pkg

import { WebhooksRepository } from './webhooks.repository.js'

function toDto(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    url: row.url,
    events: row.events,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // never expose secret in responses
  }
}

function deliveryDto(row: any) {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    eventType: row.event_type,
    payload: row.payload,
    status: row.status,
    httpStatus: row.http_status,
    responseBody: row.response_body,
    attempts: row.attempts,
    nextRetryAt: row.next_retry_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  }
}

async function assertWorkspaceMember(repo: WebhooksRepository, workspaceId: string, userId: string) {
  const isMember = await repo.isWorkspaceMember(workspaceId, userId)
  if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
}

async function assertWebhookAccess(
  repo: WebhooksRepository,
  webhookId: string,
  userId: string,
): Promise<ReturnType<WebhooksRepository['getWebhook']> extends Promise<infer T> ? NonNullable<T> : never> {
  const webhook = await repo.getWebhook(webhookId)
  if (!webhook) throw new AppError(ErrorCode.WEBHOOK_NOT_FOUND)
  await assertWorkspaceMember(repo, webhook.workspace_id, userId)
  return webhook as any
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export function createWebhookHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateWebhookSchema, req.body) as any
    await assertWorkspaceMember(repo, input.workspaceId, req.auth!.userId)

    const secret = input.secret ?? crypto.randomBytes(32).toString('hex')

    const webhook = await repo.createWebhook({
      workspaceId: input.workspaceId,
      name: input.name,
      url: input.url,
      secret,
      events: input.events,
      createdBy: req.auth!.userId,
    })

    res.status(201).json({ data: toDto(webhook) })
  })
}

export function listWebhooksHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId } = req.params as { workspaceId: string }
    await assertWorkspaceMember(repo, workspaceId, req.auth!.userId)
    const webhooks = await repo.listByWorkspace(workspaceId)
    res.json({ data: webhooks.map(toDto) })
  })
}

export function getWebhookHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params as { webhookId: string }
    const webhook = await assertWebhookAccess(repo, webhookId, req.auth!.userId)
    res.json({ data: toDto(webhook) })
  })
}

export function updateWebhookHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params as { webhookId: string }
    await assertWebhookAccess(repo, webhookId, req.auth!.userId)

    const input = validate(UpdateWebhookSchema, req.body) as any

    // Map camelCase -> snake_case for the DB update
    const dbUpdates: Record<string, unknown> = {}
    if (input.name !== undefined) dbUpdates['name'] = input.name
    if (input.url !== undefined) dbUpdates['url'] = input.url
    if (input.secret !== undefined) dbUpdates['secret'] = input.secret
    if (input.events !== undefined) dbUpdates['events'] = input.events
    if (input.isActive !== undefined) dbUpdates['is_active'] = input.isActive

    const updated = await repo.updateWebhook(webhookId, dbUpdates as any)
    res.json({ data: toDto(updated) })
  })
}

export function deleteWebhookHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params as { webhookId: string }
    await assertWebhookAccess(repo, webhookId, req.auth!.userId)
    await repo.deleteWebhook(webhookId)
    res.status(204).end()
  })
}

export function listDeliveriesHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params as { webhookId: string }
    await assertWebhookAccess(repo, webhookId, req.auth!.userId)
    const limit = Math.min(Number(req.query['limit'] || 50), 200)
    const deliveries = await repo.listDeliveries(webhookId, limit)
    res.json({ data: deliveries.map(deliveryDto) })
  })
}

export function testWebhookHandler(db: Pool) {
  const repo = new WebhooksRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params as { webhookId: string }
    const webhook = await assertWebhookAccess(repo, webhookId, req.auth!.userId)

    const testPayload = {
      event: 'ping',
      webhookId: webhook.id,
      message: 'This is a test delivery from ClickUp',
      sentAt: new Date().toISOString(),
    }

    const body = JSON.stringify({ event: 'ping', payload: testPayload, deliveredAt: new Date().toISOString() })
    const sig = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')

    const delivery = await repo.createDelivery({
      webhookId: webhook.id,
      eventType: 'ping',
      payload: testPayload,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    let httpStatus: number | null = null
    let responseBody: string | null = null
    let status = 'failed'

    try {
      const fetchRes = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ClickUp-Signature': 'sha256=' + sig,
          'X-ClickUp-Event': 'ping',
        },
        body,
        signal: controller.signal,
      })
      httpStatus = fetchRes.status
      responseBody = (await fetchRes.text()).slice(0, 1000)
      status = httpStatus >= 200 && httpStatus < 300 ? 'success' : 'failed'
    } catch (err: any) {
      responseBody = err.message?.slice(0, 500)
    } finally {
      clearTimeout(timeout)
    }

    await repo.updateDelivery(delivery.id, {
      status,
      httpStatus,
      responseBody,
      deliveredAt: status === 'success' ? new Date() : null,
      attempts: 1,
    })

    res.json({ data: deliveryDto({ ...delivery, status, http_status: httpStatus, response_body: responseBody, attempts: 1 }) })
  })
}
