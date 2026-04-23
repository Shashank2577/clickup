"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateListStatusSchema = exports.CreateListStatusSchema = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
exports.CreateListStatusSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
    isClosed: zod_1.z.boolean().optional().default(false),
    position: zod_1.z.number().int().nonnegative().optional(),
});
exports.UpdateListStatusSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    isClosed: zod_1.z.boolean().optional(),
    position: zod_1.z.number().int().nonnegative().optional(),
});
//# sourceMappingURL=status.schema.js.map