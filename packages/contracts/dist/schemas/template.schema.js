"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskTemplateSchema = exports.CreateTaskTemplateSchema = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
const isoDate = zod_1.z.string().datetime({ offset: true });
exports.CreateTaskTemplateSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(5000).optional(),
    templateData: zod_1.z.object({
        title: zod_1.z.string().min(1).max(500),
        description: zod_1.z.string().max(50000).optional(),
        priority: zod_1.z.string().optional(),
        estimatedMinutes: zod_1.z.number().int().positive().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        checklists: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            items: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string() })),
        })).optional(),
    }),
});
exports.UpdateTaskTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(5000).optional(),
    templateData: zod_1.z.record(zod_1.z.unknown()).optional(),
});
//# sourceMappingURL=template.schema.js.map