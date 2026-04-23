// ============================================================
// Notification Digest Service
// Runs as a background job every hour.
// For users who have email_enabled = true, collects unread
// notifications from the last 24h and sends a daily digest.
// ============================================================
import { logger } from '@clickup/sdk';
import { EmailService } from '../email/email.service.js';
const emailService = new EmailService();
async function buildDigestBody(notifications, userName) {
    const lines = [
        `Hi ${userName},`,
        '',
        `You have ${notifications.length} unread notification${notifications.length !== 1 ? 's' : ''} from the last 24 hours:`,
        '',
    ];
    for (const notif of notifications.slice(0, 20)) {
        const payload = notif.payload;
        let line = '';
        switch (notif.type) {
            case 'task.assigned':
                line = `• Task assigned to you: "${payload['taskTitle'] ?? 'a task'}"`;
                break;
            case 'task.mentioned':
                line = `• You were mentioned in task: "${payload['taskTitle'] ?? 'a task'}"`;
                break;
            case 'comment.mentioned':
                line = `• You were @mentioned in a comment on "${payload['taskTitle'] ?? 'a task'}"`;
                break;
            case 'task.status_changed':
                line = `• Task status changed: "${payload['taskTitle'] ?? 'a task'}" → ${payload['newStatus'] ?? 'updated'}`;
                break;
            case 'task.due_date':
                line = `• Task due soon: "${payload['taskTitle'] ?? 'a task'}"`;
                break;
            case 'comment.created':
                line = `• New comment on "${payload['taskTitle'] ?? 'a task'}"`;
                break;
            default:
                line = `• ${notif.type.replace(/_/g, ' ')}`;
        }
        lines.push(line);
    }
    if (notifications.length > 20) {
        lines.push(`• ... and ${notifications.length - 20} more`);
    }
    lines.push('');
    lines.push('Log in to ClickUp to view and manage your notifications.');
    return lines.join('\n');
}
export async function runDigestJob(db) {
    try {
        // Find users who have email enabled and have unread notifications in the past 24h
        // that were created more than 1 hour ago (avoid spamming fresh notifications)
        const { rows: digestTargets } = await db.query(`
      SELECT
        u.id         AS user_id,
        u.email,
        u.name,
        np.workspace_id,
        COUNT(n.id)::int AS unread_count,
        array_agg(DISTINCT n.type) AS notification_types
      FROM notification_preferences np
      JOIN users u ON u.id = np.user_id
      JOIN notifications n ON n.user_id = np.user_id
        AND n.is_read = FALSE
        AND n.created_at >= NOW() - INTERVAL '24 hours'
        AND n.created_at <= NOW() - INTERVAL '1 hour'
      WHERE np.email_enabled = TRUE
        AND (np.types->>'digest' IS NULL OR (np.types->>'digest')::boolean = TRUE)
      GROUP BY u.id, u.email, u.name, np.workspace_id
      HAVING COUNT(n.id) > 0
    `);
        if (digestTargets.length === 0) {
            logger.debug('[digest] No digest targets found');
            return;
        }
        logger.info({ count: digestTargets.length }, '[digest] Sending digests');
        for (const target of digestTargets) {
            try {
                // Get the actual notifications for this user
                const { rows: notifs } = await db.query(`SELECT type, payload, created_at FROM notifications
           WHERE user_id = $1
             AND is_read = FALSE
             AND created_at >= NOW() - INTERVAL '24 hours'
             AND created_at <= NOW() - INTERVAL '1 hour'
           ORDER BY created_at DESC
           LIMIT 50`, [target.user_id]);
                const body = await buildDigestBody(notifs, target.name ?? target.email);
                await emailService.sendNotificationEmail(target.email, `Your ClickUp digest: ${target.unread_count} notification${target.unread_count !== 1 ? 's' : ''}`, body);
                logger.debug({ userId: target.user_id, count: target.unread_count }, '[digest] Sent');
            }
            catch (err) {
                logger.warn({ err, userId: target.user_id }, '[digest] Failed for user');
            }
        }
    }
    catch (err) {
        logger.error({ err }, '[digest] Job failed');
    }
}
// Call this at service startup — runs every hour
export function startDigestRunner(db) {
    const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    // Offset first run by 5 minutes to avoid thundering herd on startup
    setTimeout(() => {
        runDigestJob(db);
        setInterval(() => runDigestJob(db), INTERVAL_MS);
    }, 5 * 60 * 1000);
    logger.info('[digest] Digest runner scheduled (hourly)');
}
//# sourceMappingURL=digest.service.js.map