"use strict";
// ============================================================
// Enums — mirrors DB enum types exactly
// All agents import from here, never define their own enums
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterCondition = exports.StatusGroup = exports.ViewType = exports.RoomPrefix = exports.SummarizeTargetType = exports.AiCapability = exports.AutomationActionType = exports.AutomationTriggerType = exports.NotificationType = exports.GoalTargetType = exports.CustomFieldType = exports.TaskRelationType = exports.TaskPriority = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["Owner"] = "owner";
    UserRole["Admin"] = "admin";
    UserRole["Member"] = "member";
    UserRole["Guest"] = "guest";
})(UserRole || (exports.UserRole = UserRole = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["Urgent"] = "urgent";
    TaskPriority["High"] = "high";
    TaskPriority["Normal"] = "normal";
    TaskPriority["Low"] = "low";
    TaskPriority["None"] = "none";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskRelationType;
(function (TaskRelationType) {
    TaskRelationType["Blocks"] = "blocks";
    TaskRelationType["BlockedBy"] = "blocked_by";
    TaskRelationType["RelatesTo"] = "relates_to";
    TaskRelationType["DuplicateOf"] = "duplicate_of";
})(TaskRelationType || (exports.TaskRelationType = TaskRelationType = {}));
var CustomFieldType;
(function (CustomFieldType) {
    CustomFieldType["Text"] = "text";
    CustomFieldType["Number"] = "number";
    CustomFieldType["Dropdown"] = "dropdown";
    CustomFieldType["Labels"] = "labels";
    CustomFieldType["Date"] = "date";
    CustomFieldType["Checkbox"] = "checkbox";
    CustomFieldType["Url"] = "url";
    CustomFieldType["Email"] = "email";
    CustomFieldType["Phone"] = "phone";
    CustomFieldType["Currency"] = "currency";
    CustomFieldType["Formula"] = "formula";
    CustomFieldType["Rating"] = "rating";
    CustomFieldType["Relationship"] = "relationship";
    CustomFieldType["Rollup"] = "rollup";
    CustomFieldType["Location"] = "location";
    CustomFieldType["Voting"] = "voting";
})(CustomFieldType || (exports.CustomFieldType = CustomFieldType = {}));
var GoalTargetType;
(function (GoalTargetType) {
    GoalTargetType["Number"] = "number";
    GoalTargetType["Currency"] = "currency";
    GoalTargetType["Boolean"] = "boolean";
    GoalTargetType["Task"] = "task";
})(GoalTargetType || (exports.GoalTargetType = GoalTargetType = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["TaskAssigned"] = "task_assigned";
    NotificationType["TaskCommented"] = "task_commented";
    NotificationType["TaskMentioned"] = "task_mentioned";
    NotificationType["TaskDueSoon"] = "task_due_soon";
    NotificationType["TaskOverdue"] = "task_overdue";
    NotificationType["TaskCompleted"] = "task_completed";
    NotificationType["GoalProgress"] = "goal_progress";
    NotificationType["WorkspaceInvite"] = "workspace_invite";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var AutomationTriggerType;
(function (AutomationTriggerType) {
    AutomationTriggerType["TaskCreated"] = "task_created";
    AutomationTriggerType["TaskStatusChanged"] = "task_status_changed";
    AutomationTriggerType["TaskAssigned"] = "task_assigned";
    AutomationTriggerType["TaskDueDateReached"] = "task_due_date_reached";
    AutomationTriggerType["TaskFieldChanged"] = "task_field_changed";
    AutomationTriggerType["CommentCreated"] = "comment_created";
})(AutomationTriggerType || (exports.AutomationTriggerType = AutomationTriggerType = {}));
var AutomationActionType;
(function (AutomationActionType) {
    AutomationActionType["AssignUser"] = "assign_user";
    AutomationActionType["ChangeStatus"] = "change_status";
    AutomationActionType["UpdateField"] = "update_field";
    AutomationActionType["AddComment"] = "add_comment";
    AutomationActionType["SendNotification"] = "send_notification";
    AutomationActionType["Webhook"] = "webhook";
    AutomationActionType["CreateTask"] = "create_task";
})(AutomationActionType || (exports.AutomationActionType = AutomationActionType = {}));
// AI capability identifiers — used by all services calling /ai/*
var AiCapability;
(function (AiCapability) {
    AiCapability["TaskBreakdown"] = "task-breakdown";
    AiCapability["Summarize"] = "summarize";
    AiCapability["Prioritize"] = "prioritize";
    AiCapability["DailyPlan"] = "daily-plan";
})(AiCapability || (exports.AiCapability = AiCapability = {}));
// Summarization target types for /ai/summarize
var SummarizeTargetType;
(function (SummarizeTargetType) {
    SummarizeTargetType["Task"] = "task";
    SummarizeTargetType["Doc"] = "doc";
    SummarizeTargetType["CommentThread"] = "comment_thread";
})(SummarizeTargetType || (exports.SummarizeTargetType = SummarizeTargetType = {}));
// WebSocket room prefixes — used by all services emitting events
var RoomPrefix;
(function (RoomPrefix) {
    RoomPrefix["Workspace"] = "workspace";
    RoomPrefix["List"] = "list";
    RoomPrefix["Task"] = "task";
    RoomPrefix["User"] = "user";
})(RoomPrefix || (exports.RoomPrefix = RoomPrefix = {}));
// View types (mirrors view_type DB enum)
var ViewType;
(function (ViewType) {
    ViewType["List"] = "list";
    ViewType["Board"] = "board";
    ViewType["Calendar"] = "calendar";
    ViewType["Timeline"] = "timeline";
    ViewType["Table"] = "table";
    ViewType["Workload"] = "workload";
    ViewType["Gantt"] = "gantt";
    ViewType["Activity"] = "activity";
    ViewType["Box"] = "box";
    ViewType["Doc"] = "doc";
})(ViewType || (exports.ViewType = ViewType = {}));
// Task status semantic groups (mirrors status_group DB enum)
var StatusGroup;
(function (StatusGroup) {
    StatusGroup["Backlog"] = "backlog";
    StatusGroup["Unstarted"] = "unstarted";
    StatusGroup["Started"] = "started";
    StatusGroup["Completed"] = "completed";
    StatusGroup["Cancelled"] = "cancelled";
})(StatusGroup || (exports.StatusGroup = StatusGroup = {}));
// Filter conditions for view filter trees
var FilterCondition;
(function (FilterCondition) {
    FilterCondition["Is"] = "is";
    FilterCondition["IsNot"] = "is_not";
    FilterCondition["Contains"] = "contains";
    FilterCondition["NotContains"] = "not_contains";
    FilterCondition["IsEmpty"] = "is_empty";
    FilterCondition["IsNotEmpty"] = "is_not_empty";
    FilterCondition["IsBefore"] = "is_before";
    FilterCondition["IsAfter"] = "is_after";
    FilterCondition["IsAnyOf"] = "is_any_of";
    FilterCondition["IsNoneOf"] = "is_none_of";
})(FilterCondition || (exports.FilterCondition = FilterCondition = {}));
//# sourceMappingURL=enums.js.map