import { Pool } from 'pg'
import { Notification, NotificationType } from '@clickup/contracts'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
}

export interface ListNotificationsInput {
  userId: string
  unreadOnly: boolean
  limit: number
  before: Date
}

async function createNotification(
  db: Pool,
  input: CreateNotificationInput,
): Promise<void> {
  await db.query(
    'INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3)',
    [input.userId, input.type, JSON.stringify(input.payload)]
  )
}

async function listNotifications(
  db: Pool,
  input: ListNotificationsInput & { category?: string },
): Promise<Notification[]> {
  const conditions = ['user_id = $1', 'created_at < $2', 'is_cleared = FALSE']
  const params: unknown[] = [input.userId, input.before]

  if (input.unreadOnly) {
    conditions.push('is_read = FALSE')
  }
  if (input.category) {
    params.push(input.category)
    conditions.push(`category = $${params.length}`)
  }

  params.push(input.limit)
  const query = `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`

  const { rows } = await db.query(query, params)
  return rows.map(mapNotificationRow) as unknown as Notification[]
}

function mapNotificationRow(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id: r['id'],
    userId: r['user_id'],
    type: r['type'],
    payload: r['payload'],
    isRead: r['is_read'],
    category: r['category'] ?? 'primary',
    snoozedUntil: r['snoozed_until'] ?? null,
    isCleared: r['is_cleared'] ?? false,
    clearedAt: r['cleared_at'] ?? null,
    createdAt: r['created_at'],
  }
}

async function snoozeNotification(
  db: Pool,
  input: { notificationId: string; userId: string; snoozeUntil: Date },
): Promise<boolean> {
  const { rowCount } = await db.query(
    'UPDATE notifications SET snoozed_until = $3 WHERE id = $1 AND user_id = $2',
    [input.notificationId, input.userId, input.snoozeUntil],
  )
  return rowCount !== null && rowCount > 0
}

async function clearNotification(
  db: Pool,
  input: { notificationId: string; userId: string },
): Promise<boolean> {
  const { rowCount } = await db.query(
    'UPDATE notifications SET is_cleared = TRUE, cleared_at = NOW() WHERE id = $1 AND user_id = $2 AND is_cleared = FALSE',
    [input.notificationId, input.userId],
  )
  return rowCount !== null && rowCount > 0
}

async function listClearedNotifications(
  db: Pool,
  userId: string,
  limit: number,
): Promise<Notification[]> {
  const { rows } = await db.query(
    `SELECT * FROM notifications WHERE user_id = $1 AND is_cleared = TRUE ORDER BY cleared_at DESC LIMIT $2`,
    [userId, limit],
  )
  return rows.map(mapNotificationRow) as unknown as Notification[]
}

async function markOneRead(
  db: Pool,
  input: { notificationId: string; userId: string },
): Promise<boolean> {
  const { rowCount } = await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [input.notificationId, input.userId]
  )
  return rowCount !== null && rowCount > 0
}

async function markAllRead(
  db: Pool,
  userId: string,
): Promise<void> {
  await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  )
}

async function deleteNotification(
  db: Pool,
  input: { notificationId: string; userId: string },
): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
    [input.notificationId, input.userId]
  )
  return rowCount !== null && rowCount > 0
}

async function getUnreadCount(
  db: Pool,
  userId: string,
): Promise<number> {
  const { rows } = await db.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  )
  return parseInt(rows[0].count, 10)
}

export interface NotificationPreferences {
  userId: string
  workspaceId: string
  emailEnabled: boolean
  types: Record<string, boolean>
}

async function getPreferences(
  db: Pool,
  userId: string,
  workspaceId: string,
): Promise<NotificationPreferences | null> {
  const { rows } = await db.query(
    'SELECT user_id, workspace_id, email_enabled, types FROM notification_preferences WHERE user_id = $1 AND workspace_id = $2',
    [userId, workspaceId],
  )
  if (!rows[0]) return null
  return {
    userId: rows[0].user_id,
    workspaceId: rows[0].workspace_id,
    emailEnabled: rows[0].email_enabled,
    types: rows[0].types || {},
  }
}

async function upsertPreferences(
  db: Pool,
  userId: string,
  workspaceId: string,
  emailEnabled: boolean,
  types: Record<string, boolean>,
): Promise<NotificationPreferences> {
  const { rows } = await db.query(
    `INSERT INTO notification_preferences (user_id, workspace_id, email_enabled, types)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, workspace_id)
     DO UPDATE SET email_enabled = EXCLUDED.email_enabled, types = EXCLUDED.types
     RETURNING user_id, workspace_id, email_enabled, types`,
    [userId, workspaceId, emailEnabled, JSON.stringify(types)],
  )
  return {
    userId: rows[0].user_id,
    workspaceId: rows[0].workspace_id,
    emailEnabled: rows[0].email_enabled,
    types: rows[0].types || {},
  }
}

// ============================================================
// Reminders
// ============================================================

export interface CreateReminderInput {
  userId: string
  title: string
  description?: string
  remindAt: Date
  entityType?: string
  entityId?: string
}

export interface Reminder {
  id: string
  userId: string
  title: string
  description: string | null
  remindAt: string
  entityType: string | null
  entityId: string | null
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

function mapReminderRow(r: Record<string, unknown>): Reminder {
  return {
    id: r['id'] as string,
    userId: r['user_id'] as string,
    title: r['title'] as string,
    description: (r['description'] as string) ?? null,
    remindAt: String(r['remind_at']),
    entityType: (r['entity_type'] as string) ?? null,
    entityId: (r['entity_id'] as string) ?? null,
    isCompleted: r['is_completed'] as boolean,
    completedAt: r['completed_at'] ? String(r['completed_at']) : null,
    createdAt: String(r['created_at']),
    updatedAt: String(r['updated_at']),
  }
}

async function createReminder(db: Pool, input: CreateReminderInput): Promise<Reminder> {
  const { rows } = await db.query(
    `INSERT INTO reminders (user_id, title, description, remind_at, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.userId, input.title, input.description ?? null, input.remindAt, input.entityType ?? null, input.entityId ?? null],
  )
  return mapReminderRow(rows[0])
}

async function listReminders(db: Pool, userId: string): Promise<Reminder[]> {
  const { rows } = await db.query(
    `SELECT * FROM reminders WHERE user_id = $1 AND is_completed = FALSE ORDER BY remind_at ASC`,
    [userId],
  )
  return rows.map(mapReminderRow)
}

async function updateReminder(
  db: Pool,
  reminderId: string,
  userId: string,
  updates: { title?: string; description?: string; remindAt?: Date; isCompleted?: boolean },
): Promise<Reminder | null> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = [reminderId, userId]

  if (updates.title !== undefined) {
    params.push(updates.title)
    setClauses.push(`title = $${params.length}`)
  }
  if (updates.description !== undefined) {
    params.push(updates.description)
    setClauses.push(`description = $${params.length}`)
  }
  if (updates.remindAt !== undefined) {
    params.push(updates.remindAt)
    setClauses.push(`remind_at = $${params.length}`)
  }
  if (updates.isCompleted !== undefined) {
    params.push(updates.isCompleted)
    setClauses.push(`is_completed = $${params.length}`)
    if (updates.isCompleted) {
      setClauses.push(`completed_at = NOW()`)
    }
  }

  const { rows } = await db.query(
    `UPDATE reminders SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params,
  )
  return rows[0] ? mapReminderRow(rows[0]) : null
}

async function deleteReminder(db: Pool, reminderId: string, userId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM reminders WHERE id = $1 AND user_id = $2',
    [reminderId, userId],
  )
  return rowCount !== null && rowCount > 0
}

export function createNotificationRepository(db: Pool) {
  return {
    createNotification: (input: CreateNotificationInput) => createNotification(db, input),
    listNotifications: (input: ListNotificationsInput & { category?: string }) => listNotifications(db, input),
    markOneRead: (input: { notificationId: string; userId: string }) => markOneRead(db, input),
    markAllRead: (userId: string) => markAllRead(db, userId),
    deleteNotification: (input: { notificationId: string; userId: string }) => deleteNotification(db, input),
    getUnreadCount: (userId: string) => getUnreadCount(db, userId),
    getPreferences: (userId: string, workspaceId: string) => getPreferences(db, userId, workspaceId),
    upsertPreferences: (
      userId: string,
      workspaceId: string,
      emailEnabled: boolean,
      types: Record<string, boolean>,
    ) => upsertPreferences(db, userId, workspaceId, emailEnabled, types),
    // New: snooze, clear, cleared list
    snoozeNotification: (input: { notificationId: string; userId: string; snoozeUntil: Date }) =>
      snoozeNotification(db, input),
    clearNotification: (input: { notificationId: string; userId: string }) =>
      clearNotification(db, input),
    listClearedNotifications: (userId: string, limit: number) =>
      listClearedNotifications(db, userId, limit),
    // Reminders
    createReminder: (input: CreateReminderInput) => createReminder(db, input),
    listReminders: (userId: string) => listReminders(db, userId),
    updateReminder: (reminderId: string, userId: string, updates: { title?: string; description?: string; remindAt?: Date; isCompleted?: boolean }) =>
      updateReminder(db, reminderId, userId, updates),
    deleteReminder: (reminderId: string, userId: string) => deleteReminder(db, reminderId, userId),
  }
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>
