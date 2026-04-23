"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAutomationSchema = exports.CreateAutomationSchema = exports.AutomationActionSchema = exports.AutomationConditionSchema = exports.AutomationActionTypeSchema = exports.AutomationTriggerTypeSchema = void 0;
const zod_1 = require("zod");
exports.AutomationTriggerTypeSchema = zod_1.z.enum([
    'task_created',
    'task_status_changed',
    'task_field_changed',
    'task_assigned',
    'comment_created',
    'workspace_member_added',
]);
exports.AutomationActionTypeSchema = zod_1.z.enum([
    'change_status',
    'assign_user',
    'update_field',
    'add_comment',
    'create_task',
    'send_notification',
    'webhook',
]);
exports.AutomationConditionSchema = zod_1.z.object({
    field: zod_1.z.string(),
    operator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']),
    value: zod_1.z.any().optional(),
});
exports.AutomationActionSchema = zod_1.z.object({
    type: exports.AutomationActionTypeSchema,
    config: zod_1.z.record(zod_1.z.any()),
});
exports.CreateAutomationSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    triggerType: exports.AutomationTriggerTypeSchema,
    triggerConfig: zod_1.z.record(zod_1.z.any()).default({}),
    conditions: zod_1.z.array(exports.AutomationConditionSchema).default([]),
    actions: zod_1.z.array(exports.AutomationActionSchema).min(1),
});
exports.UpdateAutomationSchema = exports.CreateAutomationSchema.partial();
//# sourceMappingURL=automation.schema.js.map