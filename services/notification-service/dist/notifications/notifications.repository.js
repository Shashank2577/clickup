async function createNotification(db, input) {
    await db.query('INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3)', [input.userId, input.type, JSON.stringify(input.payload)]);
}
async function listNotifications(db, input) {
    const query = 'SELECT * FROM notifications WHERE user_id = $1 AND created_at < $2' +
        (input.unreadOnly ? ' AND is_read = FALSE' : '') +
        ' ORDER BY created_at DESC LIMIT $3';
    const { rows } = await db.query(query, [input.userId, input.before, input.limit]);
    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        payload: r.payload,
        isRead: r.is_read,
        createdAt: r.created_at
    }));
}
async function markOneRead(db, input) {
    const { rowCount } = await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [input.notificationId, input.userId]);
    return rowCount !== null && rowCount > 0;
}
async function markAllRead(db, userId) {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [userId]);
}
async function deleteNotification(db, input) {
    const { rowCount } = await db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [input.notificationId, input.userId]);
    return rowCount !== null && rowCount > 0;
}
async function getUnreadCount(db, userId) {
    const { rows } = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId]);
    return parseInt(rows[0].count, 10);
}
async function getPreferences(db, userId, workspaceId) {
    const { rows } = await db.query('SELECT user_id, workspace_id, email_enabled, types FROM notification_preferences WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]);
    if (!rows[0])
        return null;
    return {
        userId: rows[0].user_id,
        workspaceId: rows[0].workspace_id,
        emailEnabled: rows[0].email_enabled,
        types: rows[0].types || {},
    };
}
async function upsertPreferences(db, userId, workspaceId, emailEnabled, types) {
    const { rows } = await db.query(`INSERT INTO notification_preferences (user_id, workspace_id, email_enabled, types)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, workspace_id)
     DO UPDATE SET email_enabled = EXCLUDED.email_enabled, types = EXCLUDED.types
     RETURNING user_id, workspace_id, email_enabled, types`, [userId, workspaceId, emailEnabled, JSON.stringify(types)]);
    return {
        userId: rows[0].user_id,
        workspaceId: rows[0].workspace_id,
        emailEnabled: rows[0].email_enabled,
        types: rows[0].types || {},
    };
}
export function createNotificationRepository(db) {
    return {
        createNotification: (input) => createNotification(db, input),
        listNotifications: (input) => listNotifications(db, input),
        markOneRead: (input) => markOneRead(db, input),
        markAllRead: (userId) => markAllRead(db, userId),
        deleteNotification: (input) => deleteNotification(db, input),
        getUnreadCount: (userId) => getUnreadCount(db, userId),
        getPreferences: (userId, workspaceId) => getPreferences(db, userId, workspaceId),
        upsertPreferences: (userId, workspaceId, emailEnabled, types) => upsertPreferences(db, userId, workspaceId, emailEnabled, types),
    };
}
//# sourceMappingURL=notifications.repository.js.map