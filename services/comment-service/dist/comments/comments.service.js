import { AppError, createServiceClient, publish, logger } from '@clickup/sdk';
import { ErrorCode, COMMENT_EVENTS } from '@clickup/contracts';
import { createCommentRepository } from './comments.repository.js';
function extractMentions(content) {
    const matches = content.matchAll(/@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g);
    return [...matches].map(m => m[1]).filter((id) => id !== undefined);
}
export function createCommentService(db) {
    const repository = createCommentRepository(db);
    const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001';
    const getIdentityClient = (traceId) => {
        const options = {};
        if (traceId)
            options.traceId = traceId;
        return createServiceClient(identityUrl, options);
    };
    const verifyMembership = async (workspaceId, userId, traceId) => {
        const client = getIdentityClient(traceId);
        try {
            const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId);
            const member = response.data?.data || response.data;
            if (!member)
                throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
            return member;
        }
        catch (err) {
            if (err instanceof AppError)
                throw err;
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    };
    return {
        createComment: async (taskId, userId, content, parentId, traceId) => {
            const task = await repository.getTaskWithWorkspace(taskId);
            if (!task)
                throw new AppError(ErrorCode.TASK_NOT_FOUND);
            await verifyMembership(task.workspaceId, userId, traceId);
            if (parentId) {
                const parent = await repository.getComment(parentId);
                if (!parent || parent.task_id !== taskId)
                    throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
                if (parent.parent_id !== null) {
                    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Replies cannot be nested beyond one level');
                }
            }
            const comment = await repository.createComment({ taskId, docId: null, userId, content, parentId });
            const mentionedUserIds = extractMentions(content);
            await publish(COMMENT_EVENTS.CREATED, {
                commentId: comment.id,
                taskId: comment.task_id,
                workspaceId: task.workspaceId,
                content: comment.content,
                parentId: comment.parent_id,
                userId: userId,
                mentionedUserIds,
                occurredAt: new Date().toISOString(),
            });
            if (mentionedUserIds.length > 0) {
                await publish(COMMENT_EVENTS.MENTIONED, {
                    commentId: comment.id,
                    taskId: comment.task_id,
                    workspaceId: task.workspaceId,
                    authorId: userId,
                    mentionedUserIds,
                    content: comment.content,
                    occurredAt: new Date().toISOString(),
                });
                logger.info({ commentId: comment.id, mentionedUserIds }, 'comment.mentioned event published');
            }
            return comment;
        },
        createDocComment: async (docId, userId, content, parentId, traceId) => {
            const doc = await repository.getDocWithWorkspace(docId);
            if (!doc)
                throw new AppError(ErrorCode.DOC_NOT_FOUND);
            await verifyMembership(doc.workspaceId, userId, traceId);
            if (parentId) {
                const parent = await repository.getComment(parentId);
                if (!parent || parent.doc_id !== docId)
                    throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
                if (parent.parent_id !== null) {
                    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Replies cannot be nested beyond one level');
                }
            }
            const comment = await repository.createComment({ taskId: null, docId, userId, content, parentId });
            const mentionedUserIds = extractMentions(content);
            await publish(COMMENT_EVENTS.CREATED, {
                commentId: comment.id,
                docId: comment.doc_id,
                workspaceId: doc.workspaceId,
                content: comment.content,
                parentId: comment.parent_id,
                userId: userId,
                mentionedUserIds,
                occurredAt: new Date().toISOString(),
            });
            if (mentionedUserIds.length > 0) {
                await publish(COMMENT_EVENTS.MENTIONED, {
                    commentId: comment.id,
                    docId: comment.doc_id,
                    workspaceId: doc.workspaceId,
                    authorId: userId,
                    mentionedUserIds,
                    content: comment.content,
                    occurredAt: new Date().toISOString(),
                });
                logger.info({ commentId: comment.id, mentionedUserIds }, 'doc comment.mentioned event published');
            }
            return comment;
        },
        listDocComments: async (docId, userId, traceId) => {
            const doc = await repository.getDocWithWorkspace(docId);
            if (!doc)
                throw new AppError(ErrorCode.DOC_NOT_FOUND);
            await verifyMembership(doc.workspaceId, userId, traceId);
            const roots = await repository.listRootDocComments(docId);
            if (roots.length === 0)
                return [];
            const rootIds = roots.map((r) => r.id);
            const replies = await repository.listReplies(rootIds);
            const rootMap = new Map(roots.map((r) => [r.id, {
                    id: r.id,
                    docId: r.doc_id,
                    parentId: r.parent_id,
                    content: r.content,
                    isResolved: r.is_resolved,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    user: { id: r.user_id, name: r.user_name, avatarUrl: r.user_avatar },
                    reactions: r.reactions || [],
                    replies: []
                }]));
            for (const reply of replies) {
                const parent = rootMap.get(reply.parent_id);
                if (parent) {
                    parent.replies.push({
                        id: reply.id,
                        docId: reply.doc_id,
                        parentId: reply.parent_id,
                        content: reply.content,
                        isResolved: reply.is_resolved,
                        createdAt: reply.created_at,
                        updatedAt: reply.updated_at,
                        user: { id: reply.user_id, name: reply.user_name, avatarUrl: reply.user_avatar },
                        reactions: reply.reactions || []
                    });
                }
            }
            return Array.from(rootMap.values());
        },
        listComments: async (taskId, userId, traceId) => {
            const task = await repository.getTaskWithWorkspace(taskId);
            if (!task)
                throw new AppError(ErrorCode.TASK_NOT_FOUND);
            await verifyMembership(task.workspaceId, userId, traceId);
            const roots = await repository.listRootComments(taskId);
            if (roots.length === 0)
                return [];
            const rootIds = roots.map((r) => r.id);
            const replies = await repository.listReplies(rootIds);
            const rootMap = new Map(roots.map((r) => [r.id, {
                    id: r.id,
                    taskId: r.task_id,
                    parentId: r.parent_id,
                    content: r.content,
                    isResolved: r.is_resolved,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    user: { id: r.user_id, name: r.user_name, avatarUrl: r.user_avatar },
                    reactions: r.reactions || [],
                    replies: []
                }]));
            for (const reply of replies) {
                const parent = rootMap.get(reply.parent_id);
                if (parent) {
                    parent.replies.push({
                        id: reply.id,
                        taskId: reply.task_id,
                        parentId: reply.parent_id,
                        content: reply.content,
                        isResolved: reply.is_resolved,
                        createdAt: reply.created_at,
                        updatedAt: reply.updated_at,
                        user: { id: reply.user_id, name: reply.user_name, avatarUrl: reply.user_avatar },
                        reactions: reply.reactions || []
                    });
                }
            }
            return Array.from(rootMap.values());
        },
        updateComment: async (commentId, userId, content) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            if (comment.user_id !== userId)
                throw new AppError(ErrorCode.COMMENT_CANNOT_EDIT_OTHERS);
            const task = await repository.getTaskWithWorkspace(comment.task_id);
            const updated = await repository.updateComment(commentId, content);
            const mentionedUserIds = extractMentions(content);
            await publish(COMMENT_EVENTS.UPDATED, {
                commentId: updated.id,
                taskId: updated.task_id,
                workspaceId: task?.workspaceId,
                content: updated.content,
                updatedBy: userId,
                occurredAt: new Date().toISOString(),
            });
            if (mentionedUserIds.length > 0) {
                await publish(COMMENT_EVENTS.MENTIONED, {
                    commentId: updated.id,
                    taskId: updated.task_id,
                    workspaceId: task?.workspaceId,
                    authorId: userId,
                    mentionedUserIds,
                    content: updated.content,
                    occurredAt: new Date().toISOString(),
                });
                logger.info({ commentId: updated.id, mentionedUserIds }, 'comment.mentioned event published on update');
            }
            return updated;
        },
        deleteComment: async (commentId, userId, traceId) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            const task = await repository.getTaskWithWorkspace(comment.task_id);
            if (!task)
                throw new AppError(ErrorCode.TASK_NOT_FOUND);
            const isAuthor = comment.user_id === userId;
            if (!isAuthor) {
                const member = await verifyMembership(task.workspaceId, userId, traceId);
                if (!['owner', 'admin'].includes(member.role)) {
                    throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
                }
            }
            await repository.softDeleteComment(commentId);
            await publish(COMMENT_EVENTS.DELETED, {
                commentId: comment.id,
                taskId: comment.task_id,
                workspaceId: task.workspaceId,
                deletedBy: userId,
                occurredAt: new Date().toISOString(),
            });
        },
        resolveComment: async (commentId, userId) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            if (comment.is_resolved)
                throw new AppError(ErrorCode.COMMENT_ALREADY_RESOLVED);
            const task = await repository.getTaskWithWorkspace(comment.task_id);
            const resolved = await repository.resolveComment(commentId);
            await publish(COMMENT_EVENTS.RESOLVED, {
                commentId: resolved.id,
                taskId: resolved.task_id,
                workspaceId: task?.workspaceId,
                resolvedBy: userId,
                occurredAt: new Date().toISOString(),
            });
            return resolved;
        },
        addReaction: async (commentId, userId, emoji) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            const task = await repository.getTaskWithWorkspace(comment.task_id);
            await repository.addReaction(commentId, userId, emoji);
            await publish(COMMENT_EVENTS.REACTION_ADDED, {
                commentId: comment.id,
                taskId: comment.task_id,
                workspaceId: task?.workspaceId,
                userId: userId,
                emoji: emoji,
                occurredAt: new Date().toISOString(),
            });
        },
        removeReaction: async (commentId, userId, emoji) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            await repository.removeReaction(commentId, userId, emoji);
        },
        getReplies: async (commentId, userId, traceId) => {
            const comment = await repository.getComment(commentId);
            if (!comment)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            const task = await repository.getTaskWithWorkspace(comment.task_id);
            if (!task)
                throw new AppError(ErrorCode.TASK_NOT_FOUND);
            await verifyMembership(task.workspaceId, userId, traceId);
            return repository.getReplies(commentId);
        },
        createReply: async (commentId, userId, content, traceId) => {
            const parent = await repository.getComment(commentId);
            if (!parent)
                throw new AppError(ErrorCode.COMMENT_NOT_FOUND);
            if (parent.parent_id !== null) {
                throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Replies cannot be nested beyond one level');
            }
            const task = await repository.getTaskWithWorkspace(parent.task_id);
            if (!task)
                throw new AppError(ErrorCode.TASK_NOT_FOUND);
            await verifyMembership(task.workspaceId, userId, traceId);
            const reply = await repository.createReply({
                parentId: commentId,
                taskId: parent.task_id ?? null,
                docId: parent.doc_id ?? null,
                userId,
                content,
            });
            const mentionedUserIds = extractMentions(content);
            await publish(COMMENT_EVENTS.CREATED, {
                commentId: reply.id,
                taskId: reply.task_id,
                workspaceId: task.workspaceId,
                content: reply.content,
                parentId: reply.parent_id,
                userId,
                mentionedUserIds,
                occurredAt: new Date().toISOString(),
            });
            if (mentionedUserIds.length > 0) {
                await publish(COMMENT_EVENTS.MENTIONED, {
                    commentId: reply.id,
                    taskId: reply.task_id,
                    workspaceId: task.workspaceId,
                    authorId: userId,
                    mentionedUserIds,
                    content: reply.content,
                    occurredAt: new Date().toISOString(),
                });
                logger.info({ commentId: reply.id, mentionedUserIds }, 'comment.mentioned event published for reply');
            }
            return reply;
        },
    };
}
//# sourceMappingURL=comments.service.js.map