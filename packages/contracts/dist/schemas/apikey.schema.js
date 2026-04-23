"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateApiKeySchema = exports.CreateApiKeySchema = void 0;
const zod_1 = require("zod");
exports.CreateApiKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    scopes: zod_1.z.array(zod_1.z.string()).min(1).default(['read']),
    expiresAt: zod_1.z.string().datetime().optional(),
});
exports.UpdateApiKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
});
//# sourceMappingURL=apikey.schema.js.map