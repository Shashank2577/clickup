import { Request, Response } from 'express'
import { AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { Pool } from 'pg'
import { createNotificationRepository } from './notifications.repository.js'

export function getPreferences(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const userId = req.auth!.userId
    const workspaceId = req.query['workspaceId'] as string | undefined
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param required')
    }
    const prefs = await repository.getPreferences(userId, workspaceId)
    // Return defaults if no row exists yet
    res.json({
      data: prefs ?? {
        userId,
        workspaceId,
        emailEnabled: true,
        types: {},
      },
    })
  }
}

export function updatePreferences(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const userId = req.auth!.userId
    const workspaceId = req.query['workspaceId'] as string | undefined
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param required')
    }
    const { emailEnabled, types } = req.body as {
      emailEnabled?: boolean
      types?: Record<string, boolean>
    }
    if (typeof emailEnabled !== 'boolean' && types === undefined) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Provide emailEnabled or types')
    }

    // Merge with existing prefs so partial updates work
    const existing = await repository.getPreferences(userId, workspaceId)
    const updatedEmailEnabled = typeof emailEnabled === 'boolean' ? emailEnabled : (existing?.emailEnabled ?? true)
    const updatedTypes = types !== undefined ? types : (existing?.types ?? {})

    const prefs = await repository.upsertPreferences(userId, workspaceId, updatedEmailEnabled, updatedTypes)
    res.json({ data: prefs })
  }
}

export function listNotifications(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const userId = req.auth!.userId
    const unreadOnly = req.query['unreadOnly'] === 'true'
    const limit = Math.min(Number(req.query['limit'] || 50), 100)
    const before = req.query['before']
      ? new Date(req.query['before'] as string)
      : new Date()

    const notifications = await repository.listNotifications({ userId, unreadOnly, limit, before })
    res.json({ data: notifications })
  }
}

export function markOneRead(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const updated = await repository.markOneRead({
      notificationId: req.params['notificationId']!,
      userId: req.auth!.userId,
    })
    if (!updated) throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'Notification not found')
    res.json({ data: { ok: true } })
  }
}

export function markAllRead(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    await repository.markAllRead(req.auth!.userId)
    res.status(204).end()
  }
}

export function deleteNotification(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const deleted = await repository.deleteNotification({
      notificationId: req.params['notificationId']!,
      userId: req.auth!.userId,
    })
    if (!deleted) throw new AppError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'Notification not found')
    res.status(204).end()
  }
}

export function getUnreadCount(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const count = await repository.getUnreadCount(req.auth!.userId)
    res.json({ data: { count } })
  }
}
