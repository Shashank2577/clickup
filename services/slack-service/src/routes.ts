import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID, createHmac, timingSafeEqual } from 'crypto'

export function createRouter(db: Pool): Router {
  const router = Router()

  // ── OAuth Install ──────────────────────────────────────────────────────────
  // GET /install?workspaceId= — redirect to Slack OAuth consent screen
  router.get(
    '/install',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')

      const state = Buffer.from(
        JSON.stringify({ workspaceId, userId: (req as any).auth!.userId }),
      ).toString('base64url')

      const params = new URLSearchParams({
        client_id:    process.env['SLACK_CLIENT_ID'] ?? '',
        scope:        'channels:read,chat:write,commands,incoming-webhook',
        redirect_uri: process.env['SLACK_REDIRECT_URI'] ?? 'http://localhost:3015/api/v1/slack/oauth/callback',
        state,
      })

      res.redirect('https://slack.com/oauth/v2/authorize?' + params.toString())
    }),
  )

  // GET /oauth/callback — handle Slack OAuth callback
  router.get(
    '/oauth/callback',
    asyncHandler(async (req, res) => {
      const { code, state } = req.query as { code: string; state: string }
      if (!code || !state) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'code and state required')

      let stateData: { workspaceId: string; userId: string }
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      } catch {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid state parameter')
      }

      // Exchange code for access token
      const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env['SLACK_CLIENT_ID']     ?? '',
          client_secret: process.env['SLACK_CLIENT_SECRET'] ?? '',
          code,
          redirect_uri:  process.env['SLACK_REDIRECT_URI']  ?? 'http://localhost:3015/api/v1/slack/oauth/callback',
        }).toString(),
      })

      const tokenData = (await tokenRes.json()) as any
      if (!tokenData.ok) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Slack OAuth failed: ' + (tokenData.error ?? 'unknown'))
      }

      await db.query(
        `INSERT INTO slack_installations
           (id, workspace_id, slack_team_id, slack_team_name, bot_user_id, bot_access_token, installed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (workspace_id) DO UPDATE
           SET slack_team_id = $3, slack_team_name = $4, bot_user_id = $5,
               bot_access_token = $6, updated_at = NOW()`,
        [
          randomUUID(), stateData.workspaceId,
          tokenData.team.id, tokenData.team.name,
          tokenData.bot_user_id, tokenData.access_token,
          stateData.userId,
        ],
      )

      res.json({ data: { installed: true, teamName: tokenData.team.name } })
    }),
  )

  // GET /status?workspaceId= — check if Slack is installed
  router.get(
    '/status',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')

      const { rows } = await db.query(
        'SELECT slack_team_id, slack_team_name, created_at FROM slack_installations WHERE workspace_id = $1',
        [workspaceId],
      )
      res.json({ data: rows[0] ?? null })
    }),
  )

  // DELETE /install?workspaceId= — uninstall Slack
  router.delete(
    '/install',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      await db.query('DELETE FROM slack_installations WHERE workspace_id = $1', [workspaceId])
      await db.query('DELETE FROM slack_channel_links WHERE workspace_id = $1', [workspaceId])
      res.status(204).send()
    }),
  )

  // ── Channel Links ──────────────────────────────────────────────────────────
  // GET /links?workspaceId= — list channel links
  router.get(
    '/links',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      const { rows } = await db.query(
        'SELECT * FROM slack_channel_links WHERE workspace_id = $1 ORDER BY created_at',
        [workspaceId],
      )
      res.json({ data: rows })
    }),
  )

  // POST /links — link a ClickUp list to a Slack channel
  router.post(
    '/links',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId, listId, slackChannelId, slackChannelName, events } = req.body as {
        workspaceId: string
        listId?: string
        slackChannelId: string
        slackChannelName?: string
        events?: string[]
      }
      if (!workspaceId || !slackChannelId) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId and slackChannelId required')
      }

      const { rows: inst } = await db.query(
        'SELECT slack_team_id FROM slack_installations WHERE workspace_id = $1',
        [workspaceId],
      )
      if (!inst[0]) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Slack not installed for this workspace')

      const { rows } = await db.query(
        `INSERT INTO slack_channel_links
           (id, workspace_id, list_id, slack_team_id, slack_channel_id, slack_channel_name, events, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (list_id, slack_channel_id) DO UPDATE
           SET events = $7
         RETURNING *`,
        [
          randomUUID(), workspaceId, listId ?? null,
          inst[0].slack_team_id, slackChannelId,
          slackChannelName ?? null,
          events ?? ['task_created', 'task_completed', 'comment_created'],
          (req as any).auth!.userId,
        ],
      )

      res.status(201).json({ data: rows[0] })
    }),
  )

  // DELETE /links/:linkId — unlink
  router.delete(
    '/links/:linkId',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.query('DELETE FROM slack_channel_links WHERE id = $1', [req.params['linkId']])
      res.status(204).send()
    }),
  )

  // ── Slack Events API Webhook ───────────────────────────────────────────────
  // POST /events — Slack sends events here
  router.post(
    '/events',
    asyncHandler(async (req, res) => {
      const signingSecret = process.env['SLACK_SIGNING_SECRET'] ?? ''

      // Verify Slack request signature
      if (signingSecret) {
        const ts = req.headers['x-slack-request-timestamp'] as string
        const sig = req.headers['x-slack-signature'] as string
        if (!ts || !sig) {
          res.status(401).json({ error: 'Missing Slack signature headers' })
          return
        }
        if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > 300) {
          res.status(401).json({ error: 'Request too old' })
          return
        }
        const base = `v0:${ts}:${JSON.stringify(req.body)}`
        const expected = 'v0=' + createHmac('sha256', signingSecret).update(base).digest('hex')
        if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          res.status(401).json({ error: 'Invalid signature' })
          return
        }
      }

      const { type, challenge } = req.body as any

      // Slack URL verification challenge
      if (type === 'url_verification') {
        res.json({ challenge })
        return
      }

      // Respond 200 immediately — process async
      res.status(200).send()

      setImmediate(() => {
        logger.info({ type }, 'Slack event received')
      })
    }),
  )

  // ── Internal: Send notification to linked channels ─────────────────────────
  // POST /notify — called by other services to send Slack messages
  router.post(
    '/notify',
    asyncHandler(async (req, res) => {
      const { workspaceId, listId, event: eventType, payload } = req.body as {
        workspaceId: string
        listId?: string
        event: string
        payload: Record<string, unknown>
      }

      const { rows: links } = await db.query(
        `SELECT scl.slack_channel_id, si.bot_access_token
         FROM slack_channel_links scl
         JOIN slack_installations si ON si.workspace_id = scl.workspace_id
         WHERE scl.workspace_id = $1
           AND ($2::uuid IS NULL OR scl.list_id = $2)
           AND $3 = ANY(scl.events)`,
        [workspaceId, listId ?? null, eventType],
      )

      let sent = 0
      let failed = 0

      for (const link of links) {
        try {
          const message = formatSlackMessage(eventType, payload)
          const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + (link as any).bot_access_token,
            },
            body: JSON.stringify({ channel: (link as any).slack_channel_id, ...message }),
          })
          if (slackRes.ok) sent++
          else failed++
        } catch {
          failed++
        }
      }

      res.json({ data: { sent, failed } })
    }),
  )

  return router
}

function formatSlackMessage(
  event: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  switch (event) {
    case 'task_created':
      return {
        text: `*New task created:* ${payload['title'] ?? 'Untitled'}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New task:* ${payload['title']}\nStatus: ${payload['status']} | Priority: ${payload['priority']}`,
            },
          },
        ],
      }
    case 'task_completed':
      return { text: `*Task completed:* ${payload['title'] ?? 'Untitled'}` }
    case 'comment_created':
      return {
        text: `*New comment* on ${payload['taskTitle'] ?? 'a task'}: ${String(payload['content'] ?? '').slice(0, 200)}`,
      }
    default:
      return { text: `Event: ${event}` }
  }
}
