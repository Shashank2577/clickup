"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSavedSearchSchema = exports.CreateSavedSearchSchema = void 0;
const zod_1 = require("zod");
exports.CreateSavedSearchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    query: zod_1.z.string().min(1).max(500),
    filters: zod_1.z.record(zod_1.z.unknown()).optional().default({}),
    workspaceId: zod_1.z.string().min(1),
});
exports.UpdateSavedSearchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    query: zod_1.z.string().min(1).max(500).optional(),
    filters: zod_1.z.record(zod_1.z.unknown()).optional(),
});
//# sourceMappingURL=savedsearch.schema.js.map