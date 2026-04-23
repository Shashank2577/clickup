"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSprintTasksSchema = exports.UpdateSprintSchema = exports.CreateSprintSchema = void 0;
const zod_1 = require("zod");
exports.CreateSprintSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    goal: zod_1.z.string().max(1000).optional(),
    startDate: zod_1.z.string().datetime({ offset: true }).optional(),
    endDate: zod_1.z.string().datetime({ offset: true }).optional(),
});
exports.UpdateSprintSchema = exports.CreateSprintSchema.partial();
exports.AddSprintTasksSchema = zod_1.z.object({
    taskIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
});
//# sourceMappingURL=sprint.schema.js.map