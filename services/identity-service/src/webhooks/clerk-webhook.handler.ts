import { Router } from 'express'
import type { Pool } from 'pg'
import { Webhook } from 'svix'

interface ClerkUserPayload {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses: Array<{ id: string; email_address: string }>
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
  }
}

interface ClerkUserDeletedData {
  id: string
  deleted: true
}

interface ClerkOrgPayload {
  type: 'organization.created' | 'organization.updated' | 'organization.deleted'
  data: {
    id: string
    name: string
    slug: string
    created_by: string
  }
}

interface ClerkMembershipPayload {
  type: 'organizationMembership.created' | 'organizationMembership.deleted'
  data: {
    organization: { id: string }
    public_user_data: { user_id: string }
    role: string
  }
}

type ClerkEvent = ClerkUserPayload | ClerkOrgPayload | ClerkMembershipPayload

export function clerkWebhookRoutes(db: Pool): Router {
  const router = Router()

  const webhookSecret = process.env['CLERK_WEBHOOK_SECRET']
  if (!webhookSecret) throw new Error('CLERK_WEBHOOK_SECRET is required')
  const wh = new Webhook(webhookSecret)

  router.post('/clerk', async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      res.status(500).json({ error: 'Raw body middleware not applied — check express.raw mount order' })
      return
    }

    let event: ClerkEvent

    try {
      event = wh.verify(req.body as Buffer, {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      }) as ClerkEvent
    } catch {
      res.status(400).json({ error: 'Invalid webhook signature' })
      return
    }

    try {
      await handleEvent(db, event)
      res.json({ received: true })
    } catch (err) {
      res.status(500).json({ error: 'Webhook processing failed' })
    }
  })

  return router
}

async function handleEvent(db: Pool, event: ClerkEvent): Promise<void> {
  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const d = event.data as ClerkUserPayload['data']
      const primaryEmail = d.email_addresses.find((e) => e.id === d.primary_email_address_id)
      if (!primaryEmail) return
      const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || primaryEmail.email_address
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, timezone)
         VALUES ($1, $2, $3, '', 'UTC')
         ON CONFLICT (id) DO UPDATE SET email = $2, name = $3`,
        [d.id, primaryEmail.email_address, name],
      )
      break
    }

    case 'user.deleted': {
      const d = (event.data as unknown) as ClerkUserDeletedData
      await db.query('DELETE FROM users WHERE id = $1', [d.id])
      break
    }

    case 'organization.created':
    case 'organization.updated': {
      const d = event.data as ClerkOrgPayload['data']
      await db.query(
        `INSERT INTO workspaces (id, name, slug, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3`,
        [d.id, d.name, d.slug, d.created_by],
      )
      break
    }

    case 'organization.deleted': {
      const d = event.data as ClerkOrgPayload['data']
      await db.query('DELETE FROM workspaces WHERE id = $1', [d.id])
      break
    }

    case 'organizationMembership.created': {
      const d = event.data as ClerkMembershipPayload['data']
      const role = d.role === 'org:admin' ? 'owner' : 'member'
      await db.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3`,
        [d.organization.id, d.public_user_data.user_id, role],
      )
      break
    }

    case 'organizationMembership.deleted': {
      const d = event.data as ClerkMembershipPayload['data']
      await db.query(
        'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [d.organization.id, d.public_user_data.user_id],
      )
      break
    }
  }
}
