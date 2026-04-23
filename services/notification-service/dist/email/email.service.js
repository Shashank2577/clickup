import nodemailer from 'nodemailer';
import { logger } from '@clickup/sdk';
function createTransport() {
    const host = process.env['SMTP_HOST'];
    if (!host) {
        // No SMTP configured — use jsonTransport which logs to console
        logger.info('SMTP_HOST not set; email transport is in dry-run mode (jsonTransport)');
        return nodemailer.createTransport({ jsonTransport: true });
    }
    return nodemailer.createTransport({
        host,
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: parseInt(process.env['SMTP_PORT'] || '587', 10) === 465,
        auth: {
            user: process.env['SMTP_USER'] || '',
            pass: process.env['SMTP_PASS'] || '',
        },
    });
}
export class EmailService {
    transporter;
    from;
    constructor() {
        this.transporter = createTransport();
        this.from = process.env['SMTP_FROM'] || 'noreply@clickup-oss.local';
    }
    async sendNotificationEmail(to, subject, body) {
        try {
            const info = await this.transporter.sendMail({
                from: this.from,
                to,
                subject,
                text: body,
                html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
            });
            logger.info({ to, subject, messageId: info.messageId }, 'email sent');
        }
        catch (err) {
            logger.error({ err, to, subject }, 'failed to send email notification');
        }
    }
    async sendMentionEmail(to, commenterName, taskTitle, commentUrl) {
        const subject = `${commenterName} mentioned you in a comment`;
        const body = [
            `Hi,`,
            ``,
            `${commenterName} mentioned you in a comment on task: "${taskTitle}".`,
            ``,
            `View the comment: ${commentUrl}`,
            ``,
            `— ClickUp OSS`,
        ].join('\n');
        await this.sendNotificationEmail(to, subject, body);
    }
    async sendTaskAssignedEmail(to, assignerName, taskTitle) {
        const subject = `${assignerName} assigned you a task`;
        const body = [
            `Hi,`,
            ``,
            `${assignerName} has assigned you the task: "${taskTitle}".`,
            ``,
            `Log in to ClickUp OSS to view and manage this task.`,
            ``,
            `— ClickUp OSS`,
        ].join('\n');
        await this.sendNotificationEmail(to, subject, body);
    }
}
//# sourceMappingURL=email.service.js.map