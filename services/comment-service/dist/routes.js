import { Router } from 'express';
import { requireAuth } from '@clickup/sdk';
import { createCommentHandler, listCommentsHandler, createDocCommentHandler, listDocCommentsHandler, updateCommentHandler, deleteCommentHandler, resolveCommentHandler, addReactionHandler, removeReactionHandler, createReplyHandler, getRepliesHandler, } from './comments/comments.handler.js';
import { commentAssignmentsRouter, myAssignedCommentsHandler } from './comments/assignments.handler.js';
export function createRouter(db) {
    const router = Router();
    router.post('/tasks/:taskId/comments', requireAuth, createCommentHandler(db));
    router.get('/tasks/:taskId/comments', requireAuth, listCommentsHandler(db));
    // Doc comments
    router.post('/docs/:docId/comments', requireAuth, createDocCommentHandler(db));
    router.get('/docs/:docId/comments', requireAuth, listDocCommentsHandler(db));
    // My assigned comments — must come before /:commentId routes to avoid conflict
    router.get('/me/assigned-comments', requireAuth, myAssignedCommentsHandler(db));
    router.patch('/:commentId', requireAuth, updateCommentHandler(db));
    router.delete('/:commentId', requireAuth, deleteCommentHandler(db));
    router.post('/:commentId/resolve', requireAuth, resolveCommentHandler(db));
    router.post('/:commentId/reactions', requireAuth, addReactionHandler(db));
    router.delete('/:commentId/reactions/:emoji', requireAuth, removeReactionHandler(db));
    // Threaded replies
    router.post('/:commentId/replies', requireAuth, createReplyHandler(db));
    router.get('/:commentId/replies', requireAuth, getRepliesHandler(db));
    // Comment assignments (assign/unassign/resolve)
    router.use(commentAssignmentsRouter(db));
    return router;
}
//# sourceMappingURL=routes.js.map