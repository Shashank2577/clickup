"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskListQuerySchema = exports.UpdateChecklistItemSchema = exports.CreateChecklistItemSchema = exports.CreateChecklistSchema = exports.AddTaskRelationSchema = exports.AddTaskTagSchema = exports.MoveTaskSchema = exports.UpdateTaskSchema = exports.CreateTaskSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../types/enums.js");
const uuid = zod_1.z.string().uuid();
const isoDate = zod_1.z.string().datetime({ offset: true });
exports.CreateTaskSchema = zod_1.z.object({
    listId: uuid,
    parentId: uuid.optional(),
    title: zod_1.z.string().min(1, 'Title is required').max(500, 'Title too long'),
    description: zod_1.z.string().max(50000).optional(),
    status: zod_1.z.string().max(100).optional(),
    priority: zod_1.z.nativeEnum(enums_js_1.TaskPriority).optional().default(enums_js_1.TaskPriority.None),
    assigneeId: uuid.optional(),
    dueDate: isoDate.optional(),
    startDate: isoDate.optional(),
    estimatedMinutes: zod_1.z.number().int().positive().optional(),
    sprintPoints: zod_1.z.number().int().nonnegative().optional(),
    tags: zod_1.z.array(zod_1.z.string().min(1).max(50)).max(20).optional().default([]),
});
exports.UpdateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500).optional(),
    description: zod_1.z.string().max(50000).nullable().optional(),
    status: zod_1.z.string().max(100).optional(),
    priority: zod_1.z.nativeEnum(enums_js_1.TaskPriority).optional(),
    assigneeId: uuid.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    startDate: isoDate.nullable().optional(),
    estimatedMinutes: zod_1.z.number().int().positive().nullable().optional(),
    sprintPoints: zod_1.z.number().int().nonnegative().nullable().optional(),
});
exports.MoveTaskSchema = zod_1.z.object({
    listId: uuid,
    parentId: uuid.nullable().optional(),
    position: zod_1.z.number().optional(),
});
exports.AddTaskTagSchema = zod_1.z.object({
    tag: zod_1.z.string().min(1).max(50),
});
exports.AddTaskRelationSchema = zod_1.z.object({
    relatedTaskId: uuid,
    type: zod_1.z.nativeEnum(enums_js_1.TaskRelationType),
});
exports.CreateChecklistSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional().default('Checklist'),
});
exports.CreateChecklistItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500),
    assigneeId: uuid.optional(),
    dueDate: isoDate.optional(),
});
exports.UpdateChecklistItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500).optional(),
    completed: zod_1.z.boolean().optional(),
    assigneeId: uuid.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
});
exports.TaskListQuerySchema = zod_1.z.object({
    listId: uuid,
    status: zod_1.z.string().optional(),
    assigneeId: uuid.optional(),
    priority: zod_1.z.nativeEnum(enums_js_1.TaskPriority).optional(),
    dueBefore: isoDate.optional(),
    dueAfter: isoDate.optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional().default(50),
    includeSubtasks: zod_1.z.coerce.boolean().optional().default(false),
});
//# sourceMappingURL=task.schema.js.map