// ============================================================
// NATS Event Schemas
// Every domain event emitted in the system is defined here.
// Format: {domain}.{action}
// All agents import event types from here.
// ============================================================

// ============================================================
// TASK EVENTS
// ============================================================

export const TASK_EVENTS = {
  CREATED: 'task.created',
  UPDATED: 'task.updated',
  DELETED: 'task.deleted',
  MOVED: 'task.moved',
  ASSIGNED: 'task.assigned',
  COMPLETED: 'task.completed',
  STATUS_CHANGED: 'task.status_changed',
  DUE_DATE_CHANGED: 'task.due_date_changed',
  RELATION_ADDED: 'task.relation_added',
} as const

export interface TaskCreatedEvent {
  taskId: string
  listId: string
  spaceId: string
  workspaceId: string
  title: string
  createdBy: string
  assigneeId: string | null
  parentId: string | null
  occurredAt: string
}

export interface TaskUpdatedEvent {
  taskId: string
  listId: string
  workspaceId: string
  changes: Partial<{
    title: string
    description: string
    status: string
    priority: string
    dueDate: string | null
    estimatedMinutes: number | null
  }>
  updatedBy: string
  occurredAt: string
}

export interface TaskDeletedEvent {
  taskId: string
  listId: string
  workspaceId: string
  deletedBy: string
  occurredAt: string
}

export interface TaskMovedEvent {
  taskId: string
  oldListId: string
  newListId: string
  oldParentId: string | null
  newParentId: string | null
  workspaceId: string
  movedBy: string
  occurredAt: string
}

export interface TaskAssignedEvent {
  taskId: string
  listId: string
  workspaceId: string
  assigneeId: string
  previousAssigneeId: string | null
  assignedBy: string
  occurredAt: string
}

export interface TaskCompletedEvent {
  taskId: string
  listId: string
  workspaceId: string
  completedBy: string
  occurredAt: string
}

export interface TaskStatusChangedEvent {
  taskId: string
  listId: string
  workspaceId: string
  oldStatus: string
  newStatus: string
  changedBy: string
  occurredAt: string
}

// ============================================================
// COMMENT EVENTS
// ============================================================

export const COMMENT_EVENTS = {
  CREATED: 'comment.created',
  UPDATED: 'comment.updated',
  DELETED: 'comment.deleted',
  RESOLVED: 'comment.resolved',
  REACTION_ADDED: 'comment.reaction_added',
} as const

export interface CommentCreatedEvent {
  commentId: string
  taskId: string
  listId: string
  workspaceId: string
  userId: string
  content: string
  mentionedUserIds: string[]
  occurredAt: string
}

export interface CommentDeletedEvent {
  commentId: string
  taskId: string
  workspaceId: string
  deletedBy: string
  occurredAt: string
}

export interface CommentResolvedEvent {
  commentId: string
  taskId: string
  workspaceId: string
  resolvedBy: string
  occurredAt: string
}

// ============================================================
// DOC EVENTS
// ============================================================

export const DOC_EVENTS = {
  CREATED: 'doc.created',
  UPDATED: 'doc.updated',
  DELETED: 'doc.deleted',
} as const

export interface DocCreatedEvent {
  docId: string
  workspaceId: string
  title: string
  parentId: string | null
  createdBy: string
  isPublic: boolean
  occurredAt: string
}

export interface DocUpdatedEvent {
  docId: string
  workspaceId: string
  title: string
  isPublic: boolean
  updatedBy: string
  occurredAt: string
}

export interface DocDeletedEvent {
  docId: string
  workspaceId: string
  deletedIds: string[]
  deletedBy: string
  occurredAt: string
}

// ============================================================
// WORKSPACE EVENTS
// ============================================================

export const WORKSPACE_EVENTS = {
  MEMBER_ADDED: 'workspace.member_added',
  MEMBER_REMOVED: 'workspace.member_removed',
  MEMBER_ROLE_CHANGED: 'workspace.member_role_changed',
} as const

export interface WorkspaceMemberAddedEvent {
  workspaceId: string
  userId: string
  role: string
  addedBy: string
  occurredAt: string
}

export interface WorkspaceMemberRemovedEvent {
  workspaceId: string
  userId: string
  removedBy: string
  occurredAt: string
}

// ============================================================
// NOTIFICATION EVENTS
// ============================================================

export const NOTIFICATION_EVENTS = {
  SEND: 'notification.send',
} as const

export interface NotificationSendEvent {
  userId: string
  type: string
  payload: Record<string, unknown>
  occurredAt: string
}

// ============================================================
// FILE EVENTS
// ============================================================

export const FILE_EVENTS = {
  UPLOADED: 'file.uploaded',
  DELETED: 'file.deleted',
} as const

export interface FileUploadedEvent {
  fileId: string
  taskId: string | null
  workspaceId: string
  name: string
  mimeType: string
  uploadedBy: string
  occurredAt: string
}

// ============================================================
// GOAL EVENTS
// ============================================================

export const GOAL_EVENTS = {
  CREATED: 'goal.created',
  PROGRESS_UPDATED: 'goal.progress_updated',
  COMPLETED: 'goal.completed',
} as const

export interface GoalProgressUpdatedEvent {
  goalId: string
  targetId: string
  workspaceId: string
  oldValue: number
  newValue: number
  occurredAt: string
}

// ============================================================
// VIEW EVENTS
// ============================================================

export const VIEW_EVENTS = {
  CREATED: 'view.created',
  UPDATED: 'view.updated',
  DELETED: 'view.deleted',
} as const

export interface ViewCreatedEvent {
  viewId: string
  listId: string | null
  workspaceId: string
  type: string
  createdBy: string
  occurredAt: string
}

export interface ViewUpdatedEvent {
  viewId: string
  workspaceId: string
  updatedBy: string
  occurredAt: string
}

// ============================================================
// All event subjects — use these constants when publishing
// ============================================================

export const ALL_EVENTS = {
  ...TASK_EVENTS,
  ...COMMENT_EVENTS,
  ...DOC_EVENTS,
  ...WORKSPACE_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...FILE_EVENTS,
  ...GOAL_EVENTS,
  ...VIEW_EVENTS,
} as const

export type EventSubject = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS]
