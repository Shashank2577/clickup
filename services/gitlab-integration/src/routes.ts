import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { randomUUID, timingSafeEqual } from 'crypto'

// ============================================================
// Migration SQL (would be in migration 011):
//
// CREATE TABLE IF NOT EXISTS gitlab_installations (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
//   gitlab_url TEXT NOT NULL DEFAULT 'https://gitlab.com',
//   access_token TEXT NOT NULL,
//   gitlab_user_id TEXT,
//   gitlab_username TEXT,
//   installed_by UUID REFERENCES users(id),
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE TABLE IF NOT EXISTS gitlab_mr_links (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
//   workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
//   project_path TEXT NOT NULL,
//   mr_iid INTEGER NOT NULL,
//   mr_title TEXT,
//   mr_state TEXT,
//   mr_url TEXT,
//   sha TEXT,
//   linked_by UUID REFERENCES users(id),
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   UNIQUE (task_id, project_path, mr_iid)
// );
// ============================================================

export function createRouter(db: Pool): Router {
  const router = Router()

  const GITLAB_APP_ID = process.env['GITLAB_APP_ID'] ?? ''
  const GITLAB_APP_SECRET = process.env['GITLAB_APP_SECRET'] ?? ''
  const GITLAB_REDIRECT_URI = process.env['GITLAB_REDIRECT_URI'] ?? 'http://localhost:3017/oauth/callback'
  const GITLAB_WEBHOOK_SECRET = process.env['GITLAB_WEBHOOK_SECRET'] ?? ''

  // ── GitLab OAuth Install ────────────────────────────────────────────────────
  // GET /install?workspaceId= — redirect to GitLab OAuth authorization
  router.get(
    '/install',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')

      const gitlabUrl = process.env['GITLAB_URL'] ?? 'https://gitlab.com'

      const state = Buffer.from(
        JSON.stringify({ workspaceId, userId: (req as any).auth!.userId }),
      ).toString('base64url')

      const params = new URLSearchParams({
        client_id: GITLAB_APP_ID,
        redirect_uri: GITLAB_REDIRECT_URI,
        response_type: 'code',
        scope: 'api',
        state,
      })

      res.redirect(`${gitlabUrl}/oauth/authorize?${params.toString()}`)
    }),
  )

  // GET /oauth/callback — GitLab calls this after OAuth authorization
  router.get(
    '/oauth/callback',
    asyncHandler(async (req: Request, res: Response) => {
      const code = req.query['code'] as string
      const state = req.query['state'] as string

      if (!code || !state) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'code and state required')
      }

      let stateData: { workspaceId: string; userId: string }
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      } catch {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid state')
      }

      const gitlabUrl = process.env['GITLAB_URL'] ?? 'https://gitlab.com'

      // Exchange code for access token
      const tokenRes = await fetch(`${gitlabUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GITLAB_APP_ID,
          client_secret: GITLAB_APP_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: GITLAB_REDIRECT_URI,
        }),
      })

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text()
        logger.error({ status: tokenRes.status, body: errBody }, 'GitLab token exchange failed')
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'GitLab token exchange failed')
      }

      const tokenData = (await tokenRes.json()) as { access_token: string }
      const accessToken = tokenData.access_token

      // Fetch GitLab user info
      let gitlabUserId: string | null = null
      let gitlabUsername: string | null = null

      try {
        const userRes = await fetch(`${gitlabUrl}/api/v4/user`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (userRes.ok) {
          const userData = (await userRes.json()) as any
          gitlabUserId = userData.id != null ? String(userData.id) : null
          gitlabUsername = userData.username ?? null
        }
      } catch (err) {
        logger.warn({ err }, 'Could not fetch GitLab user details')
      }

      await db.query(
        `INSERT INTO gitlab_installations
           (id, workspace_id, gitlab_url, access_token, gitlab_user_id, gitlab_username, installed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (workspace_id) DO UPDATE
           SET gitlab_url = $3, access_token = $4, gitlab_user_id = $5,
               gitlab_username = $6`,
        [
          randomUUID(), stateData.workspaceId,
          gitlabUrl, accessToken,
          gitlabUserId, gitlabUsername,
          stateData.userId,
        ],
      )

      res.json({ data: { installed: true, username: gitlabUsername } })
    }),
  )

  // GET /status?workspaceId= — check GitLab installation status
  router.get(
    '/status',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      const { rows } = await db.query(
        `SELECT gitlab_url, gitlab_user_id, gitlab_username, created_at
         FROM gitlab_installations WHERE workspace_id = $1`,
        [workspaceId],
      )
      res.json({ data: rows[0] ?? null })
    }),
  )

  // DELETE /install?workspaceId= — remove GitLab installation
  router.delete(
    '/install',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')
      await db.query('DELETE FROM gitlab_installations WHERE workspace_id = $1', [workspaceId])
      await db.query('DELETE FROM gitlab_mr_links WHERE workspace_id = $1', [workspaceId])
      res.status(204).send()
    }),
  )

  // ── MR Links ──────────────────────────────────────────────────────────────
  // GET /tasks/:taskId/mrs — list MRs linked to a task
  router.get(
    '/tasks/:taskId/mrs',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params
      const { rows } = await db.query(
        'SELECT * FROM gitlab_mr_links WHERE task_id = $1 ORDER BY created_at DESC',
        [taskId],
      )
      res.json({ data: rows })
    }),
  )

  // POST /tasks/:taskId/mrs — manually link an MR to a task
  router.post(
    '/tasks/:taskId/mrs',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params
      const { projectPath, mrIid, workspaceId } = req.body as {
        projectPath: string
        mrIid: number
        workspaceId: string
      }
      if (!projectPath || !mrIid || !workspaceId) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'projectPath, mrIid, and workspaceId required')
      }

      // Look up the installation to get the access token and gitlab URL
      const { rows: instRows } = await db.query<{ gitlab_url: string; access_token: string }>(
        'SELECT gitlab_url, access_token FROM gitlab_installations WHERE workspace_id = $1',
        [workspaceId],
      )
      const installation = instRows[0]

      // Fetch MR details from GitLab API
      let mrTitle: string | null = null
      let mrState: string | null = null
      let mrUrl: string | null = null
      let sha: string | null = null

      if (installation) {
        const gitlabUrl = installation.gitlab_url
        const encodedPath = encodeURIComponent(projectPath)
        try {
          const glRes = await fetch(
            `${gitlabUrl}/api/v4/projects/${encodedPath}/merge_requests/${mrIid}`,
            {
              headers: {
                Authorization: `Bearer ${installation.access_token}`,
              },
            },
          )
          if (glRes.ok) {
            const mrData = (await glRes.json()) as any
            mrTitle = mrData.title ?? null
            mrState = mrData.state ?? null
            mrUrl = mrData.web_url ?? null
            sha = mrData.sha ?? null
          }
        } catch (err) {
          logger.warn({ err }, 'Could not fetch MR details from GitLab')
        }
      }

      const { rows } = await db.query(
        `INSERT INTO gitlab_mr_links
           (id, task_id, workspace_id, project_path, mr_iid, mr_title, mr_state, mr_url, sha, linked_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (task_id, project_path, mr_iid) DO UPDATE
           SET mr_title = $6, mr_state = $7, mr_url = $8, sha = $9, updated_at = NOW()
         RETURNING *`,
        [
          randomUUID(), taskId, workspaceId,
          projectPath, mrIid,
          mrTitle, mrState, mrUrl, sha,
          (req as any).auth!.userId,
        ],
      )

      res.status(201).json({ data: rows[0] })
    }),
  )

  // DELETE /tasks/:taskId/mrs/:mrId — unlink MR
  router.delete(
    '/tasks/:taskId/mrs/:mrId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      await db.query(
        'DELETE FROM gitlab_mr_links WHERE id = $1 AND task_id = $2',
        [req.params['mrId'], req.params['taskId']],
      )
      res.status(204).send()
    }),
  )

  // ── GitLab Webhook Receiver ─────────────────────────────────────────────
  // POST /webhooks — GitLab sends push/MR events here
  router.post(
    '/webhooks',
    asyncHandler(async (req: Request, res: Response) => {
      // Verify X-Gitlab-Token header
      if (GITLAB_WEBHOOK_SECRET) {
        const token = req.headers['x-gitlab-token'] as string
        if (!token) {
          res.status(401).json({ error: 'Missing X-Gitlab-Token header' })
          return
        }
        try {
          if (!timingSafeEqual(Buffer.from(token), Buffer.from(GITLAB_WEBHOOK_SECRET))) {
            res.status(401).json({ error: 'Invalid webhook token' })
            return
          }
        } catch {
          res.status(401).json({ error: 'Webhook token validation failed' })
          return
        }
      }

      const eventType = req.headers['x-gitlab-event'] as string
      const payload = req.body as any

      // Respond 200 immediately — process async
      res.status(200).send()

      setImmediate(async () => {
        try {
          if (eventType === 'Merge Request Hook') {
            await handleMrEvent(db, payload)
          } else if (eventType === 'Push Hook') {
            await handlePushEvent(db, payload)
          }
        } catch (err) {
          logger.error({ err, eventType }, 'GitLab webhook processing failed')
        }
      })
    }),
  )

  // ── Projects ──────────────────────────────────────────────────────────────
  // GET /projects?workspaceId= — list GitLab projects accessible to installation
  router.get(
    '/projects',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId required')

      const { rows: instRows } = await db.query<{ gitlab_url: string; access_token: string }>(
        'SELECT gitlab_url, access_token FROM gitlab_installations WHERE workspace_id = $1',
        [workspaceId],
      )
      const installation = instRows[0]
      if (!installation) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'GitLab not installed for this workspace')
      }

      const gitlabUrl = installation.gitlab_url

      try {
        const glRes = await fetch(
          `${gitlabUrl}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`,
          {
            headers: { Authorization: `Bearer ${installation.access_token}` },
          },
        )
        if (!glRes.ok) {
          const errBody = await glRes.text()
          logger.error({ status: glRes.status, body: errBody }, 'Failed to fetch GitLab projects')
          throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Failed to fetch GitLab projects')
        }
        const projects = (await glRes.json()) as any[]
        const mapped = projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          path_with_namespace: p.path_with_namespace,
          web_url: p.web_url,
          default_branch: p.default_branch,
          last_activity_at: p.last_activity_at,
        }))
        res.json({ data: mapped })
      } catch (err) {
        if (err instanceof AppError) throw err
        logger.error({ err }, 'GitLab projects fetch error')
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Failed to fetch GitLab projects')
      }
    }),
  )

  return router
}

// ── Webhook event handlers ──────────────────────────────────────────────────

async function handleMrEvent(db: Pool, payload: any): Promise<void> {
  const mr = payload.object_attributes
  const projectPath = payload.project?.path_with_namespace as string
  if (!mr || !projectPath) return

  // Look for task references in MR title/description: "CU-<uuid>" or "#task-<uuid>"
  const text = `${mr.title ?? ''} ${mr.description ?? ''}`
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
          `INSERT INTO gitlab_mr_links
             (id, task_id, workspace_id, project_path, mr_iid, mr_title, mr_state, mr_url, sha)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (task_id, project_path, mr_iid) DO UPDATE
             SET mr_title = $6, mr_state = $7, mr_url = $8, sha = $9, updated_at = NOW()`,
          [
            randomUUID(), task.id, task.workspace_id,
            projectPath, mr.iid,
            mr.title, mr.state,
            mr.url, mr.last_commit?.id ?? null,
          ],
        )
      }
    } catch (err) {
      logger.error({ err, ref }, 'Failed to link MR to task')
    }
  }
}

async function handlePushEvent(db: Pool, payload: any): Promise<void> {
  const commits = (payload.commits as any[]) ?? []
  const projectPath = payload.project?.path_with_namespace as string
  if (!projectPath || commits.length === 0) return

  for (const commit of commits) {
    const message = commit.message as string ?? ''
    const taskRefs = [...message.matchAll(/(?:CU-|closes?|fixes?)\s+([a-f0-9-]{8,})/gi)].map((m) => m[1]!)
    if (taskRefs.length > 0) {
      logger.info({ projectPath, sha: commit.id, taskRefs }, 'GitLab push references tasks')
    }
  }
}
