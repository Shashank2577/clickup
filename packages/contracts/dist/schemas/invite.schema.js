"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcceptInviteSchema = exports.CreateInviteSchema = void 0;
const zod_1 = require("zod");
exports.CreateInviteSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['admin', 'member', 'guest']).default('member'),
});
exports.AcceptInviteSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
//# sourceMappingURL=invite.schema.js.map