import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ── Email Inbound Handler ─────────────────────────────────────────────────────
// POST /email/inbound — webhook endpoint for inbound email parsing services
// (SendGrid, Mailgun, etc.)

export function emailInboundHandler(db: Pool) {
  return asyncHandler(async (req: Request, res: Response) => {
    const { from, to, subject, text, html } = req.body as {
      from: string
      to: string
      subject: string
      text?: string
      html?: string
    }

    if (!from || !to || !subject) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'from, to, and subject are required')
    }

    // Parse listId from the "to" address format: list-{uuid}@...
    const listMatch = /^list-([a-f0-9-]{36})@/i.exec(to)
    if (!listMatch) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid to address format — expected list-{uuid}@...')
    }
    const listId = listMatch[1]!

    // Verify list exists
    const { rows: listRows } = await db.query(
      `SELECT l.id, s.workspace_id FROM lists l JOIN spaces s ON s.id = l.space_id WHERE l.id = $1`,
      [listId],
    )
    const listMeta = listRows[0]
    if (!listMeta) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'List not found')
    }

    // Find user by from email
    const { rows: userRows } = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [from.trim().toLowerCase()],
    )
    const user = userRows[0]

    // Use the matched user as creator, or null if unknown sender
    const createdBy = user?.id ?? null

    // Create task: title = subject, description = text or html
    const taskId = randomUUID()
    const basePath = '/' + listId + '/'
    const path = basePath + taskId + '/'
    const description = text || html || null

    await db.query(
      `INSERT INTO tasks (id, list_id, title, description, status, priority, path, created_by, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
      [taskId, listId, subject, description, 'open', 'none', path, createdBy],
    )

    logger.info({ taskId, from, listId }, 'Task created from inbound email')

    res.status(200).json({ data: { taskId } })
  })
}

// ── Send Email from Task ──────────────────────────────────────────────────────
// POST /:taskId/email/send

export function emailRouter(db: Pool): Router {
  const router = Router({ mergeParams: true })

  router.post(
    '/send',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params
      const userId = (req as any).auth!.userId

      const { to, subject, body } = req.body as {
        to: string[]
        subject: string
        body: string
      }

      if (!to || !Array.isArray(to) || to.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'to must be a non-empty array of email addresses')
      }
      if (!subject) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'subject is required')
      if (!body) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'body is required')

      // Verify task exists and get workspace
      const { rows: taskRows } = await db.query<{ id: string; list_id: string }>(
        `SELECT t.id, t.list_id FROM tasks t WHERE t.id = $1 AND t.deleted_at IS NULL`,
        [taskId],
      )
      const task = taskRows[0]
      if (!task) throw new AppError(ErrorCode.TASK_NOT_FOUND)

      // Verify workspace membership
      const { rows: listRows } = await db.query<{ workspace_id: string }>(
        `SELECT s.workspace_id FROM lists l JOIN spaces s ON s.id = l.space_id WHERE l.id = $1`,
        [task.list_id],
      )
      const listMeta = listRows[0]
      if (!listMeta) throw new AppError(ErrorCode.TASK_NOT_FOUND)

      const { rows: memberRows } = await db.query<{ role: string }>(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [listMeta.workspace_id, userId],
      )
      if (!memberRows[0]) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      // TODO: Integrate with actual email transport (notification-service, SMTP, or external API)
      // For now, we log the intent and record it as a comment on the task.
      logger.info({ taskId, to, subject }, 'Email send requested from task')

      // Record the email send as a comment on the task
      await db.query(
        `INSERT INTO comments (id, task_id, content, author_id) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), taskId, `Email sent to ${to.join(', ')}: ${subject}\n\n${body}`, userId],
      )

      res.status(200).json({ data: { sent: true, to, subject } })
    }),
  )

  return router
}
