export declare const Rooms: {
    readonly workspace: (workspaceId: string) => string;
    readonly list: (listId: string) => string;
    readonly task: (taskId: string) => string;
    readonly user: (userId: string) => string;
};
export declare const EmitRules: {
    readonly 'task.created': (payload: {
        listId: string;
        workspaceId: string;
    }) => string[];
    readonly 'task.updated': (payload: {
        taskId: string;
        listId: string;
    }) => string[];
    readonly 'task.deleted': (payload: {
        taskId: string;
        listId: string;
    }) => string[];
    readonly 'task.moved': (payload: {
        taskId: string;
        oldListId: string;
        newListId: string;
    }) => string[];
    readonly 'task.assigned': (payload: {
        taskId: string;
        listId: string;
        assigneeId: string;
    }) => string[];
    readonly 'task.status_changed': (payload: {
        taskId: string;
        listId: string;
    }) => string[];
    readonly 'comment.created': (payload: {
        taskId: string;
        workspaceId: string;
    }) => string[];
    readonly 'comment.updated': (payload: {
        taskId: string;
    }) => string[];
    readonly 'comment.deleted': (payload: {
        taskId: string;
    }) => string[];
    readonly 'comment.resolved': (payload: {
        taskId: string;
    }) => string[];
    readonly 'doc.created': (payload: {
        workspaceId: string;
    }) => string[];
    readonly 'doc.updated': (payload: {
        workspaceId: string;
    }) => string[];
    readonly 'workspace.member_added': (payload: {
        workspaceId: string;
        userId: string;
    }) => string[];
    readonly 'workspace.member_removed': (payload: {
        workspaceId: string;
        userId: string;
    }) => string[];
    readonly 'notification.send': (payload: {
        userId: string;
    }) => string[];
};
export interface SubscriptionRules {
    onWorkspaceLoad: (workspaceId: string) => string[];
    onListOpen: (listId: string) => string[];
    onTaskOpen: (taskId: string) => string[];
    onUserConnect: (userId: string) => string[];
}
export declare const ClientSubscriptions: SubscriptionRules;
//# sourceMappingURL=rooms.d.ts.map