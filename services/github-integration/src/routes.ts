import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID, createHmac, timingSafeEqual } from 'crypto'

export function createRouter(db: Pool): Router {
  const router = Router()

  // ── GitHub App Install ─────────────────────────────────────────────────────
  // GET /install?workspaceId= — redirect to GitHub App install page
  router.get(
    '/install',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')

      const state = Buffer.from(
        JSON.stringify({ workspaceId, userId: (req as any).auth!.userId }),
      ).toString('base64url')

      const appSlug = process.env['GITHUB_APP_SLUG'] ?? 'clickup-oss'
      res.redirect(`https://github.com/apps/${appSlug}/installations/new?state=${state}`)
    }),
  )

  // GET /oauth/callback — GitHub calls this after installation
  router.get(
    '/oauth/callback',
    asyncHandler(async (req, res) => {
      const installationId = req.query['installation_id'] as string
      const state = req.query['state'] as string

      if (!installationId || !state) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'installation_id and state required')
      }

      let stateData: { workspaceId: string; userId: string }
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      } catch {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid state')
      }

      // Fetch installation details from GitHub API
      let accountLogin: string | null = null
      let accountType: string | null = null

      try {
        const ghRes = await fetch(
          `https://api.github.com/app/installations/${installationId}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              ...(process.env['GITHUB_APP_JWT']
                ? { Authorization: `Bearer ${process.env['GITHUB_APP_JWT']}` }
                : {}),
            },
          },
        )
        if (ghRes.ok) {
          const data = (await ghRes.json()) as any
          accountLogin = data.account?.login ?? null
          accountType = data.account?.type ?? null
        }
      } catch (err) {
        logger.warn({ err }, 'Could not fetch GitHub installation details')
      }

      await db.query(
        `INSERT INTO github_installations
           (id, workspace_id, github_installation_id, github_account_login, github_account_type, installed_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (workspace_id) DO UPDATE
           SET github_installation_id = $3, github_account_login = $4,
               github_account_type = $5, updated_at = NOW()`,
        [
          randomUUID(), stateData.workspaceId,
          parseInt(installationId, 10),
          accountLogin, accountType,
          stateData.userId,
        ],
      )

      res.json({ data: { installed: true, account: accountLogin } })
    }),
  )

  // GET /status?workspaceId= — check GitHub installation status
  router.get(
    '/status',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      const { rows } = await db.query(
        `SELECT github_installation_id, github_account_login, github_account_type, created_at
         FROM github_installations WHERE workspace_id = $1`,
        [workspaceId],
      )
      res.json({ data: rows[0] ?? null })
    }),
  )

  // DELETE /install?workspaceId= — remove GitHub installation
  router.delete(
    '/install',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      await db.query('DELETE FROM github_installations WHERE workspace_id = $1', [workspaceId])
      await db.query('DELETE FROM github_repo_subscriptions WHERE workspace_id = $1', [workspaceId])
      res.status(204).send()
    }),
  )

  // ── PR Links ───────────────────────────────────────────────────────────────
  // GET /tasks/:taskId/prs — list PRs linked to a task
  router.get(
    '/tasks/:taskId/prs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { taskId } = req.params
      const { rows } = await db.query(
        'SELECT * FROM github_pr_links WHERE task_id = $1 ORDER BY created_at DESC',
        [taskId],
      )
      res.json({ data: rows })
    }),
  )

  // POST /tasks/:taskId/prs — manually link a PR to a task
  router.post(
    '/tasks/:taskId/prs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { taskId } = req.params
      const { repoFullName, prNumber, workspaceId } = req.body as {
        repoFullName: string
        prNumber: number
        workspaceId: string
      }
      if (!repoFullName || !prNumber || !workspaceId) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'repoFullName, prNumber, and workspaceId required')
      }

      // Fetch PR details from GitHub (public repos only — no auth needed)
      let prTitle: string | null = null
      let prState: string | null = null
      let prUrl: string | null = null
      let sha: string | null = null

      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        )
        if (ghRes.ok) {
          const prData = (await ghRes.json()) as any
          prTitle = prData.title ?? null
          prState = prData.merged ? 'merged' : (prData.state ?? null)
          prUrl = prData.html_url ?? null
          sha = prData.head?.sha ?? null
        }
      } catch (err) {
        logger.warn({ err }, 'Could not fetch PR details from GitHub')
      }

      const { rows } = await db.query(
        `INSERT INTO github_pr_links
           (id, task_id, workspace_id, repo_full_name, pr_number, pr_title, pr_state, pr_url, sha, linked_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (task_id, repo_full_name, pr_number) DO UPDATE
           SET pr_title = $6, pr_state = $7, pr_url = $8, sha = $9, updated_at = NOW()
         RETURNING *`,
        [
          randomUUID(), taskId, workspaceId,
          repoFullName, prNumber,
          prTitle, prState, prUrl, sha,
          (req as any).auth!.userId,
        ],
      )

      res.status(201).json({ data: rows[0] })
    }),
  )

  // DELETE /tasks/:taskId/prs/:prId — unlink PR
  router.delete(
    '/tasks/:taskId/prs/:prId',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.query(
        'DELETE FROM github_pr_links WHERE id = $1 AND task_id = $2',
        [req.params['prId'], req.params['taskId']],
      )
      res.status(204).send()
    }),
  )

  // ── GitHub Webhook Receiver ────────────────────────────────────────────────
  // POST /webhooks — GitHub sends push/PR events here
  router.post(
    '/webhooks',
    asyncHandler(async (req, res) => {
      const webhookSecret = process.env['GITHUB_WEBHOOK_SECRET'] ?? ''

      if (webhookSecret) {
        const signature = req.headers['x-hub-signature-256'] as string
        if (!signature) {
          res.status(401).json({ error: 'Missing signature' })
          return
        }
        const body = JSON.stringify(req.body)
        const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(body).digest('hex')
        try {
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            res.status(401).json({ error: 'Invalid signature' })
            return
          }
        } catch {
          res.status(401).json({ error: 'Signature validation failed' })
          return
        }
      }

      const event = req.headers['x-github-event'] as string
      const payload = req.body as any

      // Respond 200 immediately — process async
      res.status(200).send()

      setImmediate(async () => {
        try {
          if (event === 'pull_request') {
            await handlePrEvent(db, payload)
          } else if (event === 'push') {
            await handlePushEvent(db, payload)
          }
        } catch (err) {
          logger.error({ err, event }, 'GitHub webhook processing failed')
        }
      })
    }),
  )

  // ── Repo Subscriptions ─────────────────────────────────────────────────────
  // GET /repos?workspaceId= — list subscribed repos
  router.get(
    '/repos',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      const { rows } = await db.query(
        'SELECT * FROM github_repo_subscriptions WHERE workspace_id = $1 ORDER BY created_at',
        [workspaceId],
      )
      res.json({ data: rows })
    }),
  )

  // POST /repos — subscribe to a repo
  router.post(
    '/repos',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId, repoFullName } = req.body as {
        workspaceId: string
        repoFullName: string
      }
      if (!workspaceId || !repoFullName) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId and repoFullName required')
      }
      const { rows } = await db.query(
        `INSERT INTO github_repo_subscriptions (id, workspace_id, repo_full_name)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`,
        [randomUUID(), workspaceId, repoFullName],
      )
      res.status(201).json({ data: rows[0] ?? null })
    }),
  )

  // DELETE /repos/:repoId — unsubscribe
  router.delete(
    '/repos/:repoId',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.query('DELETE FROM github_repo_subscriptions WHERE id = $1', [req.params['repoId']])
      res.status(204).send()
    }),
  )

  return router
}

// ── Webhook event handlers ─────────────────────────────────────────────────

async function handlePrEvent(db: Pool, payload: any): Promise<void> {
  const pr = payload.pull_request
  const repoFullName = payload.repository?.full_name as string
  if (!pr || !repoFullName) return

  // Look for task references in PR title/body: "CU-<uuid>" or "#task-<uuid>"
  const text = `${pr.title ?? ''} ${pr.body ?? ''}`
  const taskRefs = [...text.matchAll(/(?:CU-|#task-)([a-f0-9-]{8,})/gi)].map((m) => m[1]!)

  if (taskRefs.length === 0) return

  for (const ref of taskRefs) {
    try {
      const { rows: taskRows } = await db.query(
        `SELECT id, workspace_id FROM tasks
         WHERE (id::text = $1 OR human_readable_id = $1) AND deleted_at IS NULL`,
        [ref],
      )

      for (const task of taskRows) {
        await db.query(
          `INSERT INTO github_pr_links
             (id, task_id, workspace_id, repo_full_name, pr_number, pr_title, pr_state, pr_url, sha)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (task_id, repo_full_name, pr_number) DO UPDATE
             SET pr_title = $6, pr_state = $7, pr_url = $8, sha = $9, updated_at = NOW()`,
          [
            randomUUID(), task.id, task.workspace_id,
            repoFullName, pr.number,
            pr.title, pr.merged ? 'merged' : pr.state,
            pr.html_url, pr.head?.sha ?? null,
          ],
        )
      }
    } catch (err) {
      logger.error({ err, ref }, 'Failed to link PR to task')
    }
  }
}

async function handlePushEvent(db: Pool, payload: any): Promise<void> {
  const commits = (payload.commits as any[]) ?? []
  const repoFullName = payload.repository?.full_name as string
  if (!repoFullName || commits.length === 0) return

  for (const commit of commits) {
    const message = commit.message as string ?? ''
    const taskRefs = [...message.matchAll(/(?:CU-|closes?|fixes?)\s+([a-f0-9-]{8,})/gi)].map((m) => m[1]!)
    if (taskRefs.length > 0) {
      logger.info({ repoFullName, sha: commit.id, taskRefs }, 'GitHub push references tasks')
    }
  }
}
