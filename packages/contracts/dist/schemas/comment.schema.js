"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddReactionSchema = exports.UpdateCommentSchema = exports.CreateCommentSchema = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
exports.CreateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Comment cannot be empty').max(10000, 'Comment too long'),
    parentId: uuid.optional(),
});
exports.UpdateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(10000),
});
exports.AddReactionSchema = zod_1.z.object({
    emoji: zod_1.z.string().min(1).max(10),
});
//# sourceMappingURL=comment.schema.js.map