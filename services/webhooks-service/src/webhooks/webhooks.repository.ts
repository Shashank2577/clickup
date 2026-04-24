import { Pool } from 'pg'

export interface WebhookSubscription {
  id: string
  workspace_id: string
  name: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, unknown>
  status: string
  http_status: number | null
  response_body: string | null
  attempts: number
  next_retry_at: Date | null
  delivered_at: Date | null
  created_at: Date
}

export class WebhooksRepository {
  constructor(private readonly db: Pool) {}

  async createWebhook(input: {
    workspaceId: string
    name: string
    url: string
    secret: string
    events: string[]
    createdBy: string
  }): Promise<WebhookSubscription> {
    const { rows } = await this.db.query<WebhookSubscription>(
      `INSERT INTO webhook_subscriptions (workspace_id, name, url, secret, events, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.workspaceId, input.name, input.url, input.secret, input.events, input.createdBy],
    )
    return rows[0]!
  }

  async getWebhook(id: string): Promise<WebhookSubscription | null> {
    const { rows } = await this.db.query<WebhookSubscription>(
      'SELECT * FROM webhook_subscriptions WHERE id = $1',
      [id],
    )
    return rows[0] || null
  }

  async listByWorkspace(workspaceId: string): Promise<WebhookSubscription[]> {
    const { rows } = await this.db.query<WebhookSubscription>(
      'SELECT * FROM webhook_subscriptions WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    )
    return rows
  }

  async updateWebhook(
    id: string,
    updates: {
      name?: string
      url?: string
      secret?: string
      events?: string[]
      is_active?: boolean
    },
  ): Promise<WebhookSubscription | null> {
    const fields = Object.keys(updates) as (keyof typeof updates)[]
    if (fields.length === 0) return this.getWebhook(id)

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const values = fields.map(f => updates[f])

    const { rows } = await this.db.query<WebhookSubscription>(
      `UPDATE webhook_subscriptions SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    )
    return rows[0] || null
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.db.query('DELETE FROM webhook_subscriptions WHERE id = $1', [id])
  }

  async getActiveWebhooksForEvent(
    workspaceId: string,
    eventType: string,
  ): Promise<WebhookSubscription[]> {
    const { rows } = await this.db.query<WebhookSubscription>(
      `SELECT * FROM webhook_subscriptions
       WHERE workspace_id = $1
         AND is_active = TRUE
         AND $2 = ANY(events)`,
      [workspaceId, eventType],
    )
    return rows
  }

  async createDelivery(input: {
    webhookId: string
    eventType: string
    payload: unknown
  }): Promise<WebhookDelivery> {
    const { rows } = await this.db.query<WebhookDelivery>(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.webhookId, input.eventType, JSON.stringify(input.payload)],
    )
    return rows[0]!
  }

  async updateDelivery(
    id: string,
    updates: {
      status?: string
      httpStatus?: number | null
      responseBody?: string | null
      deliveredAt?: Date | null
      attempts?: number
      nextRetryAt?: Date | null
    },
  ): Promise<void> {
    const columnMap: Record<string, string> = {
      status: 'status',
      httpStatus: 'http_status',
      responseBody: 'response_body',
      deliveredAt: 'delivered_at',
      attempts: 'attempts',
      nextRetryAt: 'next_retry_at',
    }

    const keys = Object.keys(updates) as (keyof typeof updates)[]
    if (keys.length === 0) return

    const setClause = keys.map((k, i) => `${columnMap[k]} = $${i + 2}`).join(', ')
    const values = keys.map(k => updates[k])

    await this.db.query(
      `UPDATE webhook_deliveries SET ${setClause} WHERE id = $1`,
      [id, ...values],
    )
  }

  async listDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    const { rows } = await this.db.query<WebhookDelivery>(
      `SELECT * FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, limit],
    )
    return rows
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId],
    )
    return rows.length > 0
  }
}
