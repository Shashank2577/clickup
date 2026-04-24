import { Router } from 'express';
import { requireAuth, asyncHandler } from '@clickup/sdk';
import { listNotifications, markOneRead, markAllRead, deleteNotification, getUnreadCount, getPreferences, updatePreferences, } from './notifications/notifications.handler.js';
import { pushRouter } from './notifications/push.handler.js';
export function createRouter(db) {
    const router = Router();
    router.get('/unread-count', requireAuth, asyncHandler(getUnreadCount(db)));
    router.get('/', requireAuth, asyncHandler(listNotifications(db)));
    router.patch('/:notificationId/read', requireAuth, asyncHandler(markOneRead(db)));
    router.post('/read-all', requireAuth, asyncHandler(markAllRead(db)));
    router.delete('/:notificationId', requireAuth, asyncHandler(deleteNotification(db)));
    // Notification preferences
    router.get('/preferences', requireAuth, asyncHandler(getPreferences(db)));
    router.put('/preferences', requireAuth, asyncHandler(updatePreferences(db)));
    // Web push subscriptions — mounted before /:notificationId wildcard
    router.use('/push', pushRouter(db));
    return router;
}
//# sourceMappingURL=routes.js.map