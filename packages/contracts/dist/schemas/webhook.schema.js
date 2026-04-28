"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWebhookSchema = exports.CreateWebhookSchema = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
exports.CreateWebhookSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(200),
    url: zod_1.z.string().url(),
    secret: zod_1.z.string().min(8).optional(), // auto-generated if not provided
    events: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(50),
});
exports.UpdateWebhookSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    url: zod_1.z.string().url().optional(),
    secret: zod_1.z.string().min(8).optional(),
    events: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(50).optional(),
    isActive: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=webhook.schema.js.map