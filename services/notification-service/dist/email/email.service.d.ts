export declare class EmailService {
    private readonly transporter;
    private readonly from;
    constructor();
    sendNotificationEmail(to: string, subject: string, body: string): Promise<void>;
    sendMentionEmail(to: string, commenterName: string, taskTitle: string, commentUrl: string): Promise<void>;
    sendTaskAssignedEmail(to: string, assignerName: string, taskTitle: string): Promise<void>;
}
//# sourceMappingURL=email.service.d.ts.map