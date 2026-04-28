export declare enum UserRole {
    Owner = "owner",
    Admin = "admin",
    Member = "member",
    Guest = "guest"
}
export declare enum TaskPriority {
    Urgent = "urgent",
    High = "high",
    Normal = "normal",
    Low = "low",
    None = "none"
}
export declare enum TaskRelationType {
    Blocks = "blocks",
    BlockedBy = "blocked_by",
    RelatesTo = "relates_to",
    DuplicateOf = "duplicate_of"
}
export declare enum CustomFieldType {
    Text = "text",
    Number = "number",
    Dropdown = "dropdown",
    Labels = "labels",
    Date = "date",
    Checkbox = "checkbox",
    Url = "url",
    Email = "email",
    Phone = "phone",
    Currency = "currency",
    Formula = "formula",
    Rating = "rating",
    Relationship = "relationship",
    Rollup = "rollup",
    Location = "location",
    Voting = "voting"
}
export declare enum GoalTargetType {
    Number = "number",
    Currency = "currency",
    Boolean = "boolean",
    Task = "task"
}
export declare enum NotificationType {
    TaskAssigned = "task_assigned",
    TaskCommented = "task_commented",
    TaskMentioned = "task_mentioned",
    TaskDueSoon = "task_due_soon",
    TaskOverdue = "task_overdue",
    TaskCompleted = "task_completed",
    GoalProgress = "goal_progress",
    WorkspaceInvite = "workspace_invite"
}
export declare enum AutomationTriggerType {
    TaskCreated = "task_created",
    TaskStatusChanged = "task_status_changed",
    TaskAssigned = "task_assigned",
    TaskDueDateReached = "task_due_date_reached",
    TaskFieldChanged = "task_field_changed",
    CommentCreated = "comment_created"
}
export declare enum AutomationActionType {
    AssignUser = "assign_user",
    ChangeStatus = "change_status",
    UpdateField = "update_field",
    AddComment = "add_comment",
    SendNotification = "send_notification",
    Webhook = "webhook",
    CreateTask = "create_task"
}
export declare enum AiCapability {
    TaskBreakdown = "task-breakdown",
    Summarize = "summarize",
    Prioritize = "prioritize",
    DailyPlan = "daily-plan"
}
export declare enum SummarizeTargetType {
    Task = "task",
    Doc = "doc",
    CommentThread = "comment_thread"
}
export declare enum RoomPrefix {
    Workspace = "workspace",
    List = "list",
    Task = "task",
    User = "user"
}
export declare enum ViewType {
    List = "list",
    Board = "board",
    Calendar = "calendar",
    Timeline = "timeline",
    Table = "table",
    Workload = "workload",
    Gantt = "gantt",
    Activity = "activity",
    Box = "box",
    Doc = "doc",
    Team = "team",
    Map = "map",
    Mindmap = "mindmap",
    Embed = "embed"
}
export declare enum NotificationCategory {
    Primary = "primary",
    Other = "other"
}
export declare enum FormFieldType {
    Text = "text",
    Number = "number",
    Dropdown = "dropdown",
    Checkbox = "checkbox",
    Date = "date",
    Email = "email",
    Phone = "phone",
    Url = "url",
    Rating = "rating",
    FileUpload = "file_upload"
}
export declare enum StatusGroup {
    Backlog = "backlog",
    Unstarted = "unstarted",
    Started = "started",
    Completed = "completed",
    Cancelled = "cancelled"
}
export declare enum FilterCondition {
    Is = "is",
    IsNot = "is_not",
    Contains = "contains",
    NotContains = "not_contains",
    IsEmpty = "is_empty",
    IsNotEmpty = "is_not_empty",
    IsBefore = "is_before",
    IsAfter = "is_after",
    IsAnyOf = "is_any_of",
    IsNoneOf = "is_none_of"
}
//# sourceMappingURL=enums.d.ts.map