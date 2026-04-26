import { Request, Response } from 'express'
import { AppError, validate } from '@clickup/sdk'
import {
  ErrorCode,
  SnoozeNotificationSchema,
  CreateReminderSchema,
  UpdateReminderSchema,
} from '@clickup/contracts'
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
    const category = req.query['category'] as string | undefined
    const limit = Math.min(Number(req.query['limit'] || 50), 100)
    const before = req.query['before']
      ? new Date(req.query['before'] as string)
      : new Date()

    const notifications = await repository.listNotifications({ userId, unreadOnly, limit, before, category })
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

// ============================================================
// Snooze: POST /:notificationId/snooze
// ============================================================

export function snoozeNotification(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const input = validate(SnoozeNotificationSchema, req.body) as { snoozeUntil: string }
    const snoozeUntil = new Date(input.snoozeUntil)

    if (snoozeUntil <= new Date()) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'snoozeUntil must be in the future')
    }

    const updated = await repository.snoozeNotification({
      notificationId: req.params['notificationId']!,
      userId: req.auth!.userId,
      snoozeUntil,
    })
    if (!updated) throw new AppError(ErrorCode.NOTIFICATION_NOT_FOUND)
    res.json({ data: { ok: true, snoozedUntil: snoozeUntil.toISOString() } })
  }
}

// ============================================================
// Clear: POST /:notificationId/clear
// ============================================================

export function clearNotification(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const cleared = await repository.clearNotification({
      notificationId: req.params['notificationId']!,
      userId: req.auth!.userId,
    })
    if (!cleared) throw new AppError(ErrorCode.NOTIFICATION_NOT_FOUND)
    res.json({ data: { ok: true } })
  }
}

// ============================================================
// Cleared history: GET /cleared
// ============================================================

export function listClearedNotifications(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Number(req.query['limit'] || 50), 100)
    const cleared = await repository.listClearedNotifications(req.auth!.userId, limit)
    res.json({ data: cleared })
  }
}

// ============================================================
// Reminders: CRUD
// ============================================================

export function createReminder(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const input = validate(CreateReminderSchema, req.body) as {
      title: string
      description?: string
      remindAt: string
      entityType?: string
      entityId?: string
    }
    const reminder = await repository.createReminder({
      userId: req.auth!.userId,
      title: input.title,
      description: input.description,
      remindAt: new Date(input.remindAt),
      entityType: input.entityType,
      entityId: input.entityId,
    })
    res.status(201).json({ data: reminder })
  }
}

export function listReminders(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const reminders = await repository.listReminders(req.auth!.userId)
    res.json({ data: reminders })
  }
}

export function updateReminder(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const input = validate(UpdateReminderSchema, req.body) as {
      title?: string
      description?: string
      remindAt?: string
      isCompleted?: boolean
    }
    const updated = await repository.updateReminder(
      req.params['id']!,
      req.auth!.userId,
      {
        title: input.title,
        description: input.description,
        remindAt: input.remindAt ? new Date(input.remindAt) : undefined,
        isCompleted: input.isCompleted,
      },
    )
    if (!updated) throw new AppError(ErrorCode.REMINDER_NOT_FOUND)
    res.json({ data: updated })
  }
}

export function deleteReminder(db: Pool) {
  const repository = createNotificationRepository(db)
  return async (req: Request, res: Response): Promise<void> => {
    const deleted = await repository.deleteReminder(req.params['id']!, req.auth!.userId)
    if (!deleted) throw new AppError(ErrorCode.REMINDER_NOT_FOUND)
    res.status(204).end()
  }
}
