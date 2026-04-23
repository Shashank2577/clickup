"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWidgetSchema = exports.CreateWidgetSchema = exports.WidgetConfigSchema = exports.UpdateDashboardSchema = exports.CreateDashboardSchema = exports.WIDGET_TYPES = void 0;
const zod_1 = require("zod");
// ============================================================
// Dashboard widget types
// ============================================================
exports.WIDGET_TYPES = [
    'task_count',
    'task_by_status',
    'task_by_assignee',
    'task_by_priority',
    'completion_rate',
    'time_tracked',
    'time_by_user',
    'billable_time',
    'velocity',
    'burndown',
    'cumulative_flow',
    'overdue_tasks',
    'recent_activity',
    'goals_progress',
    'custom_text',
    'embed',
];
// ============================================================
// Dashboard schemas
// ============================================================
exports.CreateDashboardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    isPrivate: zod_1.z.boolean().optional().default(false),
});
exports.UpdateDashboardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    isPrivate: zod_1.z.boolean().optional(),
});
// ============================================================
// Widget config schema — flexible JSONB config per widget type
// ============================================================
exports.WidgetConfigSchema = zod_1.z.object({
    // Scope filters
    listId: zod_1.z.string().uuid().optional(),
    spaceId: zod_1.z.string().uuid().optional(),
    assigneeId: zod_1.z.string().uuid().optional(),
    // Status filter
    statuses: zod_1.z.array(zod_1.z.string()).optional(),
    // Date range
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    // Custom text / embed
    text: zod_1.z.string().optional(),
    url: zod_1.z.string().url().optional(),
}).passthrough();
// ============================================================
// Widget schemas
// ============================================================
exports.CreateWidgetSchema = zod_1.z.object({
    type: zod_1.z.enum(exports.WIDGET_TYPES),
    title: zod_1.z.string().min(1).max(255),
    config: exports.WidgetConfigSchema.optional().default({}),
    positionX: zod_1.z.number().int().min(0).optional().default(0),
    positionY: zod_1.z.number().int().min(0).optional().default(0),
    width: zod_1.z.number().int().min(1).max(12).optional().default(4),
    height: zod_1.z.number().int().min(1).max(12).optional().default(3),
});
exports.UpdateWidgetSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional(),
    config: exports.WidgetConfigSchema.optional(),
    positionX: zod_1.z.number().int().min(0).optional(),
    positionY: zod_1.z.number().int().min(0).optional(),
    width: zod_1.z.number().int().min(1).max(12).optional(),
    height: zod_1.z.number().int().min(1).max(12).optional(),
});
//# sourceMappingURL=dashboard.schema.js.map