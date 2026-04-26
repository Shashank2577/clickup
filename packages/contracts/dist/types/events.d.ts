export declare const TASK_EVENTS: {
    readonly CREATED: "task.created";
    readonly UPDATED: "task.updated";
    readonly DELETED: "task.deleted";
    readonly MOVED: "task.moved";
    readonly ASSIGNED: "task.assigned";
    readonly COMPLETED: "task.completed";
    readonly STATUS_CHANGED: "task.status_changed";
    readonly DUE_DATE_CHANGED: "task.due_date_changed";
    readonly RELATION_ADDED: "task.relation_added";
};
export interface TaskCreatedEvent {
    taskId: string;
    listId: string;
    spaceId: string;
    workspaceId: string;
    title: string;
    createdBy: string;
    assigneeId: string | null;
    parentId: string | null;
    occurredAt: string;
}
export interface TaskUpdatedEvent {
    taskId: string;
    listId: string;
    workspaceId: string;
    changes: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        dueDate: string | null;
        estimatedMinutes: number | null;
    }>;
    updatedBy: string;
    occurredAt: string;
}
export interface TaskDeletedEvent {
    taskId: string;
    listId: string;
    workspaceId: string;
    deletedBy: string;
    occurredAt: string;
}
export interface TaskMovedEvent {
    taskId: string;
    oldListId: string;
    newListId: string;
    oldParentId: string | null;
    newParentId: string | null;
    workspaceId: string;
    movedBy: string;
    occurredAt: string;
}
export interface TaskAssignedEvent {
    taskId: string;
    listId: string;
    workspaceId: string;
    assigneeId: string;
    previousAssigneeId: string | null;
    assignedBy: string;
    occurredAt: string;
}
export interface TaskCompletedEvent {
    taskId: string;
    listId: string;
    workspaceId: string;
    completedBy: string;
    occurredAt: string;
}
export interface TaskStatusChangedEvent {
    taskId: string;
    listId: string;
    workspaceId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    occurredAt: string;
}
export declare const COMMENT_EVENTS: {
    readonly CREATED: "comment.created";
    readonly UPDATED: "comment.updated";
    readonly DELETED: "comment.deleted";
    readonly RESOLVED: "comment.resolved";
    readonly REACTION_ADDED: "comment.reaction_added";
    readonly MENTIONED: "clickup.comment.mentioned";
};
export interface CommentCreatedEvent {
    commentId: string;
    taskId: string;
    listId: string;
    workspaceId: string;
    userId: string;
    content: string;
    mentionedUserIds: string[];
    occurredAt: string;
}
export interface CommentMentionedEvent {
    commentId: string;
    taskId: string;
    workspaceId: string;
    authorId: string;
    mentionedUserIds: string[];
    content: string;
    occurredAt: string;
}
export interface CommentDeletedEvent {
    commentId: string;
    taskId: string;
    workspaceId: string;
    deletedBy: string;
    occurredAt: string;
}
export interface CommentResolvedEvent {
    commentId: string;
    taskId: string;
    workspaceId: string;
    resolvedBy: string;
    occurredAt: string;
}
export declare const DOC_EVENTS: {
    readonly CREATED: "doc.created";
    readonly UPDATED: "doc.updated";
    readonly DELETED: "doc.deleted";
};
export interface DocCreatedEvent {
    docId: string;
    workspaceId: string;
    title: string;
    parentId: string | null;
    createdBy: string;
    isPublic: boolean;
    occurredAt: string;
}
export interface DocUpdatedEvent {
    docId: string;
    workspaceId: string;
    title: string;
    isPublic: boolean;
    updatedBy: string;
    occurredAt: string;
}
export interface DocDeletedEvent {
    docId: string;
    workspaceId: string;
    deletedIds: string[];
    deletedBy: string;
    occurredAt: string;
}
export declare const WORKSPACE_EVENTS: {
    readonly MEMBER_ADDED: "workspace.member_added";
    readonly MEMBER_REMOVED: "workspace.member_removed";
    readonly MEMBER_ROLE_CHANGED: "workspace.member_role_changed";
};
export interface WorkspaceMemberAddedEvent {
    workspaceId: string;
    userId: string;
    role: string;
    addedBy: string;
    occurredAt: string;
}
export interface WorkspaceMemberRemovedEvent {
    workspaceId: string;
    userId: string;
    removedBy: string;
    occurredAt: string;
}
export declare const NOTIFICATION_EVENTS: {
    readonly SEND: "notification.send";
};
export interface NotificationSendEvent {
    userId: string;
    type: string;
    payload: Record<string, unknown>;
    occurredAt: string;
}
export declare const FILE_EVENTS: {
    readonly UPLOADED: "file.uploaded";
    readonly DELETED: "file.deleted";
};
export interface FileUploadedEvent {
    fileId: string;
    taskId: string | null;
    workspaceId: string;
    name: string;
    mimeType: string;
    uploadedBy: string;
    occurredAt: string;
}
export declare const GOAL_EVENTS: {
    readonly CREATED: "goal.created";
    readonly PROGRESS_UPDATED: "goal.progress_updated";
    readonly COMPLETED: "goal.completed";
};
export interface GoalProgressUpdatedEvent {
    goalId: string;
    targetId: string;
    workspaceId: string;
    oldValue: number;
    newValue: number;
    occurredAt: string;
}
export declare const VIEW_EVENTS: {
    readonly CREATED: "view.created";
    readonly UPDATED: "view.updated";
    readonly DELETED: "view.deleted";
};
export interface ViewCreatedEvent {
    viewId: string;
    listId: string | null;
    workspaceId: string;
    type: string;
    createdBy: string;
    occurredAt: string;
}
export interface ViewUpdatedEvent {
    viewId: string;
    workspaceId: string;
    updatedBy: string;
    occurredAt: string;
}
export declare const CHAT_EVENTS: {
    readonly MESSAGE_CREATED: "chat.message_created";
    readonly MESSAGE_UPDATED: "chat.message_updated";
    readonly MESSAGE_DELETED: "chat.message_deleted";
    readonly CHANNEL_CREATED: "chat.channel_created";
    readonly CHANNEL_UPDATED: "chat.channel_updated";
    readonly CHANNEL_DELETED: "chat.channel_deleted";
    readonly MEMBER_JOINED: "chat.member_joined";
    readonly MEMBER_LEFT: "chat.member_left";
    readonly REACTION_ADDED: "chat.reaction_added";
    readonly REACTION_REMOVED: "chat.reaction_removed";
    readonly MENTIONED: "chat.mentioned";
};
export interface ChatMessageCreatedEvent {
    messageId: string;
    channelId: string;
    workspaceId: string;
    senderId: string;
    content: string;
    threadParentId: string | null;
    mentionedUserIds: string[];
    occurredAt: string;
}
export interface ChatMessageUpdatedEvent {
    messageId: string;
    channelId: string;
    workspaceId: string;
    updatedBy: string;
    content: string;
    occurredAt: string;
}
export interface ChatMessageDeletedEvent {
    messageId: string;
    channelId: string;
    workspaceId: string;
    deletedBy: string;
    occurredAt: string;
}
export interface ChatChannelCreatedEvent {
    channelId: string;
    workspaceId: string;
    name: string;
    type: string;
    createdBy: string;
    occurredAt: string;
}
export interface ChatMentionedEvent {
    messageId: string;
    channelId: string;
    workspaceId: string;
    authorId: string;
    mentionedUserIds: string[];
    content: string;
    occurredAt: string;
}
export declare const ALL_EVENTS: {
    readonly MESSAGE_CREATED: "chat.message_created";
    readonly MESSAGE_UPDATED: "chat.message_updated";
    readonly MESSAGE_DELETED: "chat.message_deleted";
    readonly CHANNEL_CREATED: "chat.channel_created";
    readonly CHANNEL_UPDATED: "chat.channel_updated";
    readonly CHANNEL_DELETED: "chat.channel_deleted";
    readonly MEMBER_JOINED: "chat.member_joined";
    readonly MEMBER_LEFT: "chat.member_left";
    readonly REACTION_ADDED: "chat.reaction_added";
    readonly REACTION_REMOVED: "chat.reaction_removed";
    readonly MENTIONED: "chat.mentioned";
    readonly CREATED: "view.created";
    readonly UPDATED: "view.updated";
    readonly DELETED: "view.deleted";
    readonly PROGRESS_UPDATED: "goal.progress_updated";
    readonly COMPLETED: "goal.completed";
    readonly UPLOADED: "file.uploaded";
    readonly SEND: "notification.send";
    readonly MEMBER_ADDED: "workspace.member_added";
    readonly MEMBER_REMOVED: "workspace.member_removed";
    readonly MEMBER_ROLE_CHANGED: "workspace.member_role_changed";
    readonly RESOLVED: "comment.resolved";
    readonly MOVED: "task.moved";
    readonly ASSIGNED: "task.assigned";
    readonly STATUS_CHANGED: "task.status_changed";
    readonly DUE_DATE_CHANGED: "task.due_date_changed";
    readonly RELATION_ADDED: "task.relation_added";
};
export type EventSubject = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS];
//# sourceMappingURL=events.d.ts.map