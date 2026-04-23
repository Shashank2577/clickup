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
  input: ListNotificationsInput,
): Promise<Notification[]> {
  const query = 'SELECT * FROM notifications WHERE user_id = $1 AND created_at < $2' + 
    (input.unreadOnly ? ' AND is_read = FALSE' : '') + 
    ' ORDER BY created_at DESC LIMIT $3'
  
  const { rows } = await db.query(query, [input.userId, input.before, input.limit])
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    payload: r.payload,
    isRead: r.is_read,
    createdAt: r.created_at
  })) as Notification[]
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

export function createNotificationRepository(db: Pool) {
  return {
    createNotification: (input: CreateNotificationInput) => createNotification(db, input),
    listNotifications: (input: ListNotificationsInput) => listNotifications(db, input),
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
  }
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>
