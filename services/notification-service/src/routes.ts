import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, asyncHandler } from '@clickup/sdk'
import {
  listNotifications,
  markOneRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  snoozeNotification,
  clearNotification,
  listClearedNotifications,
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
} from './notifications/notifications.handler.js'
import { pushRouter } from './notifications/push.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  // Core notification endpoints
  router.get('/unread-count', requireAuth, asyncHandler(getUnreadCount(db)))
  router.get('/', requireAuth, asyncHandler(listNotifications(db)))
  router.patch('/:notificationId/read', requireAuth, asyncHandler(markOneRead(db)))
  router.post('/read-all', requireAuth, asyncHandler(markAllRead(db)))
  router.delete('/:notificationId', requireAuth, asyncHandler(deleteNotification(db)))

  // Snooze & Clear — must come before /:notificationId wildcard
  router.post('/:notificationId/snooze', requireAuth, asyncHandler(snoozeNotification(db)))
  router.post('/:notificationId/clear', requireAuth, asyncHandler(clearNotification(db)))

  // Cleared history
  router.get('/cleared', requireAuth, asyncHandler(listClearedNotifications(db)))

  // Notification preferences
  router.get('/preferences', requireAuth, asyncHandler(getPreferences(db)))
  router.put('/preferences', requireAuth, asyncHandler(updatePreferences(db)))

  // Web push subscriptions
  router.use('/push', pushRouter(db))

  // ============================================================
  // Reminders
  // ============================================================
  router.post('/reminders', requireAuth, asyncHandler(createReminder(db)))
  router.get('/reminders', requireAuth, asyncHandler(listReminders(db)))
  router.patch('/reminders/:id', requireAuth, asyncHandler(updateReminder(db)))
  router.delete('/reminders/:id', requireAuth, asyncHandler(deleteReminder(db)))

  return router
}
