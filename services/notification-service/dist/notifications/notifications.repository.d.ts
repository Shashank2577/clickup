import { Pool } from 'pg';
import { Notification, NotificationType } from '@clickup/contracts';
export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
}
export interface ListNotificationsInput {
    userId: string;
    unreadOnly: boolean;
    limit: number;
    before: Date;
}
export interface NotificationPreferences {
    userId: string;
    workspaceId: string;
    emailEnabled: boolean;
    types: Record<string, boolean>;
}
export declare function createNotificationRepository(db: Pool): {
    createNotification: (input: CreateNotificationInput) => Promise<void>;
    listNotifications: (input: ListNotificationsInput) => Promise<Notification[]>;
    markOneRead: (input: {
        notificationId: string;
        userId: string;
    }) => Promise<boolean>;
    markAllRead: (userId: string) => Promise<void>;
    deleteNotification: (input: {
        notificationId: string;
        userId: string;
    }) => Promise<boolean>;
    getUnreadCount: (userId: string) => Promise<number>;
    getPreferences: (userId: string, workspaceId: string) => Promise<NotificationPreferences | null>;
    upsertPreferences: (userId: string, workspaceId: string, emailEnabled: boolean, types: Record<string, boolean>) => Promise<NotificationPreferences>;
};
export type NotificationRepository = ReturnType<typeof createNotificationRepository>;
//# sourceMappingURL=notifications.repository.d.ts.map