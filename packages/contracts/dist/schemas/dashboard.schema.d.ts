import { z } from 'zod';
export declare const WIDGET_TYPES: readonly ["task_count", "task_by_status", "task_by_assignee", "task_by_priority", "completion_rate", "time_tracked", "time_by_user", "billable_time", "velocity", "burndown", "cumulative_flow", "overdue_tasks", "recent_activity", "goals_progress", "custom_text", "embed", "burnup"];
export type WidgetType = (typeof WIDGET_TYPES)[number];
export declare const CreateDashboardSchema: z.ZodObject<{
    name: z.ZodString;
    isPrivate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPrivate: boolean;
}, {
    name: string;
    isPrivate?: boolean | undefined;
}>;
export type CreateDashboardSchemaType = z.infer<typeof CreateDashboardSchema>;
export declare const UpdateDashboardSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    isPrivate: z.ZodOptional<z.ZodBoolean>;
    reportSchedule: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        cronExpression: z.ZodOptional<z.ZodString>;
        recipientEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["pdf", "email"]>>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        format: "email" | "pdf";
        cronExpression?: string | undefined;
        recipientEmails?: string[] | undefined;
    }, {
        enabled: boolean;
        cronExpression?: string | undefined;
        recipientEmails?: string[] | undefined;
        format?: "email" | "pdf" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isPrivate?: boolean | undefined;
    reportSchedule?: {
        enabled: boolean;
        format: "email" | "pdf";
        cronExpression?: string | undefined;
        recipientEmails?: string[] | undefined;
    } | undefined;
}, {
    name?: string | undefined;
    isPrivate?: boolean | undefined;
    reportSchedule?: {
        enabled: boolean;
        cronExpression?: string | undefined;
        recipientEmails?: string[] | undefined;
        format?: "email" | "pdf" | undefined;
    } | undefined;
}>;
export type UpdateDashboardSchemaType = z.infer<typeof UpdateDashboardSchema>;
export declare const WidgetConfigSchema: z.ZodObject<{
    listId: z.ZodOptional<z.ZodString>;
    spaceId: z.ZodOptional<z.ZodString>;
    assigneeId: z.ZodOptional<z.ZodString>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    listId: z.ZodOptional<z.ZodString>;
    spaceId: z.ZodOptional<z.ZodString>;
    assigneeId: z.ZodOptional<z.ZodString>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    listId: z.ZodOptional<z.ZodString>;
    spaceId: z.ZodOptional<z.ZodString>;
    assigneeId: z.ZodOptional<z.ZodString>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export type WidgetConfigType = z.infer<typeof WidgetConfigSchema>;
export declare const CreateWidgetSchema: z.ZodObject<{
    type: z.ZodEnum<["task_count", "task_by_status", "task_by_assignee", "task_by_priority", "completion_rate", "time_tracked", "time_by_user", "billable_time", "velocity", "burndown", "cumulative_flow", "overdue_tasks", "recent_activity", "goals_progress", "custom_text", "embed", "burnup"]>;
    title: z.ZodString;
    config: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>>;
    positionX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    positionY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type: "embed" | "task_count" | "task_by_status" | "task_by_assignee" | "task_by_priority" | "completion_rate" | "time_tracked" | "time_by_user" | "billable_time" | "velocity" | "burndown" | "cumulative_flow" | "overdue_tasks" | "recent_activity" | "goals_progress" | "custom_text" | "burnup";
    config: {
        text?: string | undefined;
        url?: string | undefined;
        listId?: string | undefined;
        assigneeId?: string | undefined;
        startDate?: string | undefined;
        spaceId?: string | undefined;
        endDate?: string | undefined;
        statuses?: string[] | undefined;
    } & {
        [k: string]: unknown;
    };
    title: string;
    height: number;
    positionX: number;
    positionY: number;
    width: number;
}, {
    type: "embed" | "task_count" | "task_by_status" | "task_by_assignee" | "task_by_priority" | "completion_rate" | "time_tracked" | "time_by_user" | "billable_time" | "velocity" | "burndown" | "cumulative_flow" | "overdue_tasks" | "recent_activity" | "goals_progress" | "custom_text" | "burnup";
    title: string;
    config?: z.objectInputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    height?: number | undefined;
    positionX?: number | undefined;
    positionY?: number | undefined;
    width?: number | undefined;
}>;
export type CreateWidgetSchemaType = z.infer<typeof CreateWidgetSchema>;
export declare const UpdateWidgetSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    positionX: z.ZodOptional<z.ZodNumber>;
    positionY: z.ZodOptional<z.ZodNumber>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    config?: z.objectOutputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    title?: string | undefined;
    height?: number | undefined;
    positionX?: number | undefined;
    positionY?: number | undefined;
    width?: number | undefined;
}, {
    config?: z.objectInputType<{
        listId: z.ZodOptional<z.ZodString>;
        spaceId: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    title?: string | undefined;
    height?: number | undefined;
    positionX?: number | undefined;
    positionY?: number | undefined;
    width?: number | undefined;
}>;
export type UpdateWidgetSchemaType = z.infer<typeof UpdateWidgetSchema>;
//# sourceMappingURL=dashboard.schema.d.ts.map