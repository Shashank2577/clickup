"use strict";
// ============================================================
// NATS Event Schemas
// Every domain event emitted in the system is defined here.
// Format: {domain}.{action}
// All agents import event types from here.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_EVENTS = exports.VIEW_EVENTS = exports.GOAL_EVENTS = exports.FILE_EVENTS = exports.NOTIFICATION_EVENTS = exports.WORKSPACE_EVENTS = exports.DOC_EVENTS = exports.COMMENT_EVENTS = exports.TASK_EVENTS = void 0;
// ============================================================
// TASK EVENTS
// ============================================================
exports.TASK_EVENTS = {
    CREATED: 'task.created',
    UPDATED: 'task.updated',
    DELETED: 'task.deleted',
    MOVED: 'task.moved',
    ASSIGNED: 'task.assigned',
    COMPLETED: 'task.completed',
    STATUS_CHANGED: 'task.status_changed',
    DUE_DATE_CHANGED: 'task.due_date_changed',
    RELATION_ADDED: 'task.relation_added',
};
// ============================================================
// COMMENT EVENTS
// ============================================================
exports.COMMENT_EVENTS = {
    CREATED: 'comment.created',
    UPDATED: 'comment.updated',
    DELETED: 'comment.deleted',
    RESOLVED: 'comment.resolved',
    REACTION_ADDED: 'comment.reaction_added',
    MENTIONED: 'clickup.comment.mentioned',
};
// ============================================================
// DOC EVENTS
// ============================================================
exports.DOC_EVENTS = {
    CREATED: 'doc.created',
    UPDATED: 'doc.updated',
    DELETED: 'doc.deleted',
};
// ============================================================
// WORKSPACE EVENTS
// ============================================================
exports.WORKSPACE_EVENTS = {
    MEMBER_ADDED: 'workspace.member_added',
    MEMBER_REMOVED: 'workspace.member_removed',
    MEMBER_ROLE_CHANGED: 'workspace.member_role_changed',
};
// ============================================================
// NOTIFICATION EVENTS
// ============================================================
exports.NOTIFICATION_EVENTS = {
    SEND: 'notification.send',
};
// ============================================================
// FILE EVENTS
// ============================================================
exports.FILE_EVENTS = {
    UPLOADED: 'file.uploaded',
    DELETED: 'file.deleted',
};
// ============================================================
// GOAL EVENTS
// ============================================================
exports.GOAL_EVENTS = {
    CREATED: 'goal.created',
    PROGRESS_UPDATED: 'goal.progress_updated',
    COMPLETED: 'goal.completed',
};
// ============================================================
// VIEW EVENTS
// ============================================================
exports.VIEW_EVENTS = {
    CREATED: 'view.created',
    UPDATED: 'view.updated',
    DELETED: 'view.deleted',
};
// ============================================================
// All event subjects — use these constants when publishing
// ============================================================
exports.ALL_EVENTS = {
    ...exports.TASK_EVENTS,
    ...exports.COMMENT_EVENTS,
    ...exports.DOC_EVENTS,
    ...exports.WORKSPACE_EVENTS,
    ...exports.NOTIFICATION_EVENTS,
    ...exports.FILE_EVENTS,
    ...exports.GOAL_EVENTS,
    ...exports.VIEW_EVENTS,
};
//# sourceMappingURL=events.js.map