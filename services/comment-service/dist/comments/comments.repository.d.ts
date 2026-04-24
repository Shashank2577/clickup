import { Pool } from 'pg';
export interface CreateCommentInput {
    taskId: string | null;
    docId: string | null;
    userId: string;
    content: string;
    parentId: string | null;
}
export interface CreateReplyInput {
    parentId: string;
    taskId: string | null;
    docId: string | null;
    userId: string;
    content: string;
}
export declare function createCommentRepository(db: Pool): {
    getTaskWithWorkspace: (taskId: string) => Promise<{
        taskId: string;
        workspaceId: string;
    } | null>;
    getDocWithWorkspace: (docId: string) => Promise<{
        docId: string;
        workspaceId: string;
    } | null>;
    createComment: (input: CreateCommentInput) => Promise<any>;
    getComment: (id: string) => Promise<any>;
    listRootComments: (taskId: string) => Promise<any[]>;
    listRootDocComments: (docId: string) => Promise<any[]>;
    listReplies: (parentIds: string[]) => Promise<any[]>;
    getReplies: (parentId: string) => Promise<any[]>;
    createReply: (input: CreateReplyInput) => Promise<any>;
    updateComment: (id: string, content: string) => Promise<any>;
    softDeleteComment: (id: string) => Promise<void>;
    resolveComment: (id: string) => Promise<any>;
    addReaction: (commentId: string, userId: string, emoji: string) => Promise<void>;
    removeReaction: (commentId: string, userId: string, emoji: string) => Promise<void>;
};
//# sourceMappingURL=comments.repository.d.ts.map