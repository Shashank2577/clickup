"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGoalTargetSchema = exports.CreateGoalTargetSchema = exports.UpdateGoalSchema = exports.CreateGoalSchema = void 0;
const zod_1 = require("zod");
exports.CreateGoalSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().nullable().optional(),
    dueDate: zod_1.z.string().datetime().nullable().optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});
exports.UpdateGoalSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().nullable().optional(),
    dueDate: zod_1.z.string().datetime().nullable().optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});
exports.CreateGoalTargetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum(['number', 'currency', 'boolean', 'task']),
    targetValue: zod_1.z.number().positive().optional(),
    taskId: zod_1.z.string().uuid().optional(),
    currentValue: zod_1.z.number().min(0).optional()
});
exports.UpdateGoalTargetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    currentValue: zod_1.z.number().min(0).optional(),
    targetValue: zod_1.z.number().positive().optional(),
    taskId: zod_1.z.string().uuid().optional()
});
//# sourceMappingURL=goal.schema.js.map