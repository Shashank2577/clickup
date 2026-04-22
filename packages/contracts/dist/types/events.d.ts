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
export declare const ALL_EVENTS: {
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
    readonly REACTION_ADDED: "comment.reaction_added";
    readonly MOVED: "task.moved";
    readonly ASSIGNED: "task.assigned";
    readonly STATUS_CHANGED: "task.status_changed";
    readonly DUE_DATE_CHANGED: "task.due_date_changed";
    readonly RELATION_ADDED: "task.relation_added";
};
export type EventSubject = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS];
//# sourceMappingURL=events.d.ts.map