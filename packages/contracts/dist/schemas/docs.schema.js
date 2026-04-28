"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocListQuerySchema = exports.UpdateDocSchema = exports.CreateDocSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// Doc Validation Schemas
// ============================================================
exports.CreateDocSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().min(1),
    title: zod_1.z.string().max(500).optional(),
    content: zod_1.z.record(zod_1.z.unknown()).optional(),
    parent_id: zod_1.z.string().uuid().optional(),
    is_public: zod_1.z.boolean().optional(),
});
exports.UpdateDocSchema = zod_1.z.object({
    title: zod_1.z.string().max(500).optional(),
    content: zod_1.z.record(zod_1.z.unknown()).optional(),
    is_public: zod_1.z.boolean().optional(),
});
exports.DocListQuerySchema = zod_1.z.object({}).optional();
//# sourceMappingURL=docs.schema.js.map