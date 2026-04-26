// ============================================================
// Enums — mirrors DB enum types exactly
// All agents import from here, never define their own enums
// ============================================================

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}

export enum TaskPriority {
  Urgent = 'urgent',
  High = 'high',
  Normal = 'normal',
  Low = 'low',
  None = 'none',
}

export enum TaskRelationType {
  Blocks = 'blocks',
  BlockedBy = 'blocked_by',
  RelatesTo = 'relates_to',
  DuplicateOf = 'duplicate_of',
}

export enum CustomFieldType {
  Text = 'text',
  Number = 'number',
  Dropdown = 'dropdown',
  Labels = 'labels',
  Date = 'date',
  Checkbox = 'checkbox',
  Url = 'url',
  Email = 'email',
  Phone = 'phone',
  Currency = 'currency',
  Formula = 'formula',
  Rating = 'rating',
  Relationship = 'relationship',
  Rollup = 'rollup',
  Location = 'location',
  Voting = 'voting',
}

export enum GoalTargetType {
  Number = 'number',
  Currency = 'currency',
  Boolean = 'boolean',
  Task = 'task',
}

export enum NotificationType {
  TaskAssigned = 'task_assigned',
  TaskCommented = 'task_commented',
  TaskMentioned = 'task_mentioned',
  TaskDueSoon = 'task_due_soon',
  TaskOverdue = 'task_overdue',
  TaskCompleted = 'task_completed',
  GoalProgress = 'goal_progress',
  WorkspaceInvite = 'workspace_invite',
}

export enum AutomationTriggerType {
  TaskCreated = 'task_created',
  TaskStatusChanged = 'task_status_changed',
  TaskAssigned = 'task_assigned',
  TaskDueDateReached = 'task_due_date_reached',
  TaskFieldChanged = 'task_field_changed',
  CommentCreated = 'comment_created',
}

export enum AutomationActionType {
  AssignUser = 'assign_user',
  ChangeStatus = 'change_status',
  UpdateField = 'update_field',
  AddComment = 'add_comment',
  SendNotification = 'send_notification',
  Webhook = 'webhook',
  CreateTask = 'create_task',
}

// AI capability identifiers — used by all services calling /ai/*
export enum AiCapability {
  TaskBreakdown = 'task-breakdown',
  Summarize = 'summarize',
  Prioritize = 'prioritize',
  DailyPlan = 'daily-plan',
}

// Summarization target types for /ai/summarize
export enum SummarizeTargetType {
  Task = 'task',
  Doc = 'doc',
  CommentThread = 'comment_thread',
}

// WebSocket room prefixes — used by all services emitting events
export enum RoomPrefix {
  Workspace = 'workspace',
  List = 'list',
  Task = 'task',
  User = 'user',
}

// View types (mirrors view_type DB enum)
export enum ViewType {
  List = 'list',
  Board = 'board',
  Calendar = 'calendar',
  Timeline = 'timeline',
  Table = 'table',
  Workload = 'workload',
  Gantt = 'gantt',
  Activity = 'activity',
  Box = 'box',
  Doc = 'doc',
  Team = 'team',
  Map = 'map',
  Mindmap = 'mindmap',
  Embed = 'embed',
}

// Notification category for inbox filtering
export enum NotificationCategory {
  Primary = 'primary',
  Other = 'other',
}

// Form field types for form-service
export enum FormFieldType {
  Text = 'text',
  Number = 'number',
  Dropdown = 'dropdown',
  Checkbox = 'checkbox',
  Date = 'date',
  Email = 'email',
  Phone = 'phone',
  Url = 'url',
  Rating = 'rating',
  FileUpload = 'file_upload',
}

// Task status semantic groups (mirrors status_group DB enum)
export enum StatusGroup {
  Backlog = 'backlog',
  Unstarted = 'unstarted',
  Started = 'started',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

// Filter conditions for view filter trees
export enum FilterCondition {
  Is = 'is',
  IsNot = 'is_not',
  Contains = 'contains',
  NotContains = 'not_contains',
  IsEmpty = 'is_empty',
  IsNotEmpty = 'is_not_empty',
  IsBefore = 'is_before',
  IsAfter = 'is_after',
  IsAnyOf = 'is_any_of',
  IsNoneOf = 'is_none_of',
}
