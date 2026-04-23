import { z } from 'zod';
export declare const AutomationTriggerTypeSchema: z.ZodEnum<["task_created", "task_status_changed", "task_field_changed", "task_assigned", "comment_created", "workspace_member_added"]>;
export declare const AutomationActionTypeSchema: z.ZodEnum<["change_status", "assign_user", "update_field", "add_comment", "create_task", "send_notification", "webhook"]>;
export declare const AutomationConditionSchema: z.ZodObject<{
    field: z.ZodString;
    operator: z.ZodEnum<["equals", "not_equals", "contains", "is_empty", "is_not_empty"]>;
    value: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    field: string;
    operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
    value?: any;
}, {
    field: string;
    operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
    value?: any;
}>;
export declare const AutomationActionSchema: z.ZodObject<{
    type: z.ZodEnum<["change_status", "assign_user", "update_field", "add_comment", "create_task", "send_notification", "webhook"]>;
    config: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
    config: Record<string, any>;
}, {
    type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
    config: Record<string, any>;
}>;
export declare const CreateAutomationSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    name: z.ZodString;
    triggerType: z.ZodEnum<["task_created", "task_status_changed", "task_field_changed", "task_assigned", "comment_created", "workspace_member_added"]>;
    triggerConfig: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    conditions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "is_empty", "is_not_empty"]>;
        value: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }, {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }>, "many">>;
    actions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["change_status", "assign_user", "update_field", "add_comment", "create_task", "send_notification", "webhook"]>;
        config: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }, {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    workspaceId: string;
    triggerType: "task_assigned" | "task_created" | "task_status_changed" | "task_field_changed" | "comment_created" | "workspace_member_added";
    triggerConfig: Record<string, any>;
    conditions: {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }[];
    actions: {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }[];
}, {
    name: string;
    workspaceId: string;
    triggerType: "task_assigned" | "task_created" | "task_status_changed" | "task_field_changed" | "comment_created" | "workspace_member_added";
    actions: {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }[];
    triggerConfig?: Record<string, any> | undefined;
    conditions?: {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }[] | undefined;
}>;
export declare const UpdateAutomationSchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    triggerType: z.ZodOptional<z.ZodEnum<["task_created", "task_status_changed", "task_field_changed", "task_assigned", "comment_created", "workspace_member_added"]>>;
    triggerConfig: z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    conditions: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "is_empty", "is_not_empty"]>;
        value: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }, {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }>, "many">>>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["change_status", "assign_user", "update_field", "add_comment", "create_task", "send_notification", "webhook"]>;
        config: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }, {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    workspaceId?: string | undefined;
    triggerType?: "task_assigned" | "task_created" | "task_status_changed" | "task_field_changed" | "comment_created" | "workspace_member_added" | undefined;
    triggerConfig?: Record<string, any> | undefined;
    conditions?: {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }[] | undefined;
    actions?: {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }[] | undefined;
}, {
    name?: string | undefined;
    workspaceId?: string | undefined;
    triggerType?: "task_assigned" | "task_created" | "task_status_changed" | "task_field_changed" | "comment_created" | "workspace_member_added" | undefined;
    triggerConfig?: Record<string, any> | undefined;
    conditions?: {
        field: string;
        operator: "contains" | "is_empty" | "is_not_empty" | "equals" | "not_equals";
        value?: any;
    }[] | undefined;
    actions?: {
        type: "assign_user" | "change_status" | "update_field" | "add_comment" | "send_notification" | "webhook" | "create_task";
        config: Record<string, any>;
    }[] | undefined;
}>;
//# sourceMappingURL=automation.schema.d.ts.map