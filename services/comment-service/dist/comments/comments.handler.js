import { validate, asyncHandler } from '@clickup/sdk';
import { CreateCommentSchema, UpdateCommentSchema, AddReactionSchema } from '@clickup/contracts';
import { createCommentService } from './comments.service.js';
export function createCommentHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const { content, parentId } = validate(CreateCommentSchema, req.body);
        const comment = await service.createComment(taskId, req.auth.userId, content, parentId || null, req.headers['x-trace-id']);
        res.status(201).json({ data: comment });
    });
}
export function listCommentsHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const comments = await service.listComments(taskId, req.auth.userId, req.headers['x-trace-id']);
        res.json({ data: comments });
    });
}
export function updateCommentHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { content } = validate(UpdateCommentSchema, req.body);
        const comment = await service.updateComment(commentId, req.auth.userId, content);
        res.json({ data: comment });
    });
}
export function deleteCommentHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        await service.deleteComment(commentId, req.auth.userId, req.headers['x-trace-id']);
        res.status(204).end();
    });
}
export function resolveCommentHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const comment = await service.resolveComment(commentId, req.auth.userId);
        res.json({ data: comment });
    });
}
export function addReactionHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { emoji } = validate(AddReactionSchema, req.body);
        await service.addReaction(commentId, req.auth.userId, emoji);
        res.status(201).json({ data: { commentId, userId: req.auth.userId, emoji } });
    });
}
export function removeReactionHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId, emoji } = req.params;
        await service.removeReaction(commentId, req.auth.userId, emoji);
        res.status(204).end();
    });
}
export function createReplyHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const { content } = validate(CreateCommentSchema, req.body);
        const reply = await service.createReply(commentId, req.auth.userId, content, req.headers['x-trace-id']);
        res.status(201).json({ data: reply });
    });
}
export function getRepliesHandler(db) {
    const service = createCommentService(db);
    return asyncHandler(async (req, res) => {
        const { commentId } = req.params;
        const replies = await service.getReplies(commentId, req.auth.userId, req.headers['x-trace-id']);
        res.json({ data: replies });
    });
}
//# sourceMappingURL=comments.handler.js.map