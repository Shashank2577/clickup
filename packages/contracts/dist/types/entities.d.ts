import type { AutomationActionType, AutomationTriggerType, CustomFieldType, GoalTargetType, NotificationType, TaskPriority, TaskRelationType, UserRole } from './enums.js';
export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    timezone: string;
    createdAt: string;
}
export interface UserProfile extends User {
    workspaces: WorkspaceSummary[];
}
export interface Workspace {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    logoUrl: string | null;
    createdAt: string;
}
export interface WorkspaceSummary {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    role: UserRole;
}
export interface WorkspaceMember {
    workspaceId: string;
    userId: string;
    role: UserRole;
    joinedAt: string;
    user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}
export interface Space {
    id: string;
    workspaceId: string;
    name: string;
    color: string;
    icon: string | null;
    position: number;
    isPrivate: boolean;
    createdBy: string;
    createdAt: string;
}
export interface List {
    id: string;
    spaceId: string;
    name: string;
    color: string | null;
    position: number;
    isArchived: boolean;
    createdBy: string;
    createdAt: string;
}
export interface Task {
    id: string;
    listId: string;
    parentId: string | null;
    path: string;
    title: string;
    description: string | null;
    status: string;
    priority: TaskPriority;
    assigneeId: string | null;
    dueDate: string | null;
    startDate: string | null;
    estimatedMinutes: number | null;
    actualMinutes: number | null;
    sprintPoints: number | null;
    position: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}
export interface TaskWithRelations extends Task {
    assignee: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
    tags: string[];
    subtaskCount: number;
    commentCount: number;
    checklist: Checklist[];
    relations: TaskRelation[];
    customFields: TaskCustomFieldValue[];
    watchers: Array<Pick<User, 'id' | 'name' | 'avatarUrl'>>;
}
export interface TaskSummary {
    id: string;
    title: string;
    status: string;
    priority: TaskPriority;
    assignee: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
    dueDate: string | null;
    subtaskCount: number;
    commentCount: number;
    tags: string[];
}
export interface TaskRelation {
    id: string;
    taskId: string;
    relatedTaskId: string;
    type: TaskRelationType;
    relatedTask: TaskSummary;
}
export interface Checklist {
    id: string;
    taskId: string;
    title: string;
    position: number;
    items: ChecklistItem[];
    createdAt: string;
}
export interface ChecklistItem {
    id: string;
    checklistId: string;
    title: string;
    completed: boolean;
    assigneeId: string | null;
    dueDate: string | null;
    position: number;
    createdAt: string;
    updatedAt: string;
}
export interface Comment {
    id: string;
    taskId: string;
    userId: string;
    content: string;
    parentId: string | null;
    isResolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    reactions: CommentReaction[];
    replies?: Comment[];
}
export interface CommentReaction {
    commentId: string;
    userId: string;
    emoji: string;
    user: Pick<User, 'id' | 'name'>;
}
export interface Doc {
    id: string;
    workspaceId: string;
    title: string;
    content: Record<string, unknown>;
    parentId: string | null;
    path: string;
    isPublic: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface DocSummary {
    id: string;
    title: string;
    parentId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
}
export interface CustomField {
    id: string;
    workspaceId: string;
    name: string;
    type: CustomFieldType;
    config: Record<string, unknown>;
    createdAt: string;
}
export interface TaskCustomFieldValue {
    fieldId: string;
    field: Pick<CustomField, 'id' | 'name' | 'type'>;
    value: unknown;
}
export interface Goal {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    dueDate: string | null;
    ownerId: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    targets: GoalTarget[];
    progressPercent: number;
}
export interface GoalTarget {
    id: string;
    goalId: string;
    name: string;
    type: GoalTargetType;
    targetValue: number | null;
    currentValue: number;
    taskId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface TimeEntry {
    id: string;
    taskId: string;
    userId: string;
    minutes: number;
    billable: boolean;
    note: string | null;
    startedAt: string;
    endedAt: string;
    createdAt: string;
}
export interface File {
    id: string;
    workspaceId: string;
    taskId: string | null;
    name: string;
    url: string;
    sizeBytes: number;
    mimeType: string;
    uploadedBy: string;
    createdAt: string;
}
export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    payload: NotificationPayload;
    isRead: boolean;
    createdAt: string;
}
export type NotificationPayload = TaskAssignedPayload | TaskCommentedPayload | TaskMentionedPayload | TaskDueSoonPayload | WorkspaceInvitePayload;
export interface TaskAssignedPayload {
    taskId: string;
    taskTitle: string;
    assignedBy: string;
    assignedByName: string;
}
export interface TaskCommentedPayload {
    taskId: string;
    taskTitle: string;
    commentId: string;
    commentedBy: string;
    commentedByName: string;
}
export interface TaskMentionedPayload {
    taskId: string;
    taskTitle: string;
    mentionedBy: string;
    mentionedByName: string;
    context: string;
}
export interface TaskDueSoonPayload {
    taskId: string;
    taskTitle: string;
    dueDate: string;
    hoursUntilDue: number;
}
export interface WorkspaceInvitePayload {
    workspaceId: string;
    workspaceName: string;
    invitedBy: string;
    invitedByName: string;
    role: UserRole;
}
export interface Automation {
    id: string;
    workspaceId: string;
    name: string;
    triggerType: AutomationTriggerType;
    triggerConfig: Record<string, unknown>;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
    isEnabled: boolean;
    runCount: number;
    createdBy: string;
    createdAt: string;
}
export interface AutomationCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
    value: unknown;
}
export interface AutomationAction {
    type: AutomationActionType;
    config: Record<string, unknown>;
}
export type TaskId = string & {
    __brand: 'TaskId';
};
export type UserId = string & {
    __brand: 'UserId';
};
export type WorkspaceId = string & {
    __brand: 'WorkspaceId';
};
export type ListId = string & {
    __brand: 'ListId';
};
export type SpaceId = string & {
    __brand: 'SpaceId';
};
export type CommentId = string & {
    __brand: 'CommentId';
};
export type DocId = string & {
    __brand: 'DocId';
};
export type ViewId = string & {
    __brand: 'ViewId';
};
export interface TaskStatus {
    id: string;
    listId: string;
    name: string;
    color: string;
    group: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
    position: number;
    isDefault: boolean;
    createdAt: string;
}
export interface FilterClause {
    propertyId: string;
    condition: string;
    values: string[];
}
export interface FilterGroup {
    operation: 'and' | 'or';
    filters: Array<FilterClause | FilterGroup>;
}
export interface SortOption {
    propertyId: string;
    direction: 'asc' | 'desc';
}
export interface ViewConfig {
    groupById?: string;
    datePropertyId?: string;
    sortOptions: SortOption[];
    visiblePropertyIds: string[];
    filter: FilterGroup;
    columnWidths: Record<string, number>;
    collapsedGroups: string[];
}
export interface View {
    id: string;
    listId: string | null;
    workspaceId: string;
    name: string;
    type: string;
    config: ViewConfig;
    isPrivate: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface ViewUserState {
    viewId: string;
    userId: string;
    collapsedGroups: string[];
    hiddenColumns: string[];
    updatedAt: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
//# sourceMappingURL=entities.d.ts.map