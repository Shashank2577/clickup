import { Pool } from 'pg';
export declare function createCommentService(db: Pool): {
    createComment: (taskId: string, userId: string, content: string, parentId: string | null, traceId?: string) => Promise<any>;
    createDocComment: (docId: string, userId: string, content: string, parentId: string | null, traceId?: string) => Promise<any>;
    listDocComments: (docId: string, userId: string, traceId?: string) => Promise<{
        id: any;
        docId: any;
        parentId: any;
        content: any;
        isResolved: any;
        createdAt: any;
        updatedAt: any;
        user: {
            id: any;
            name: any;
            avatarUrl: any;
        };
        reactions: any;
        replies: any[];
    }[]>;
    listComments: (taskId: string, userId: string, traceId?: string) => Promise<{
        id: any;
        taskId: any;
        parentId: any;
        content: any;
        isResolved: any;
        createdAt: any;
        updatedAt: any;
        user: {
            id: any;
            name: any;
            avatarUrl: any;
        };
        reactions: any;
        replies: any[];
    }[]>;
    updateComment: (commentId: string, userId: string, content: string) => Promise<any>;
    deleteComment: (commentId: string, userId: string, traceId?: string) => Promise<void>;
    resolveComment: (commentId: string, userId: string) => Promise<any>;
    addReaction: (commentId: string, userId: string, emoji: string) => Promise<void>;
    removeReaction: (commentId: string, userId: string, emoji: string) => Promise<void>;
    getReplies: (commentId: string, userId: string, traceId?: string) => Promise<any[]>;
    createReply: (commentId: string, userId: string, content: string, traceId?: string) => Promise<any>;
};
//# sourceMappingURL=comments.service.d.ts.map