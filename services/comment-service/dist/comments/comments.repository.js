async function getTaskWithWorkspace(db, taskId) {
    const { rows } = await db.query('SELECT t.id AS task_id, s.workspace_id FROM tasks t JOIN lists l ON l.id = t.list_id JOIN spaces s ON s.id = l.space_id WHERE t.id = $1 AND t.deleted_at IS NULL', [taskId]);
    return rows[0] || null;
}
async function getDocWithWorkspace(db, docId) {
    const { rows } = await db.query('SELECT id AS doc_id, workspace_id FROM docs WHERE id = $1 AND deleted_at IS NULL', [docId]);
    return rows[0] || null;
}
async function listRootDocComments(db, docId) {
    const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
        'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
        'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
        'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
        'WHERE c.doc_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL ' +
        'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC';
    const { rows } = await db.query(query, [docId]);
    return rows;
}
async function createComment(db, input) {
    const { rows } = await db.query('INSERT INTO comments (task_id, doc_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', [input.taskId, input.docId, input.userId, input.content, input.parentId]);
    return rows[0];
}
async function getComment(db, id) {
    const { rows } = await db.query('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] || null;
}
async function listRootComments(db, taskId) {
    const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
        'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
        'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
        'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
        'WHERE c.task_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL ' +
        'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC';
    const { rows } = await db.query(query, [taskId]);
    return rows;
}
async function listReplies(db, parentIds) {
    const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
        'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
        'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
        'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
        'WHERE c.parent_id = ANY($1::uuid[]) AND c.deleted_at IS NULL ' +
        'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC';
    const { rows } = await db.query(query, [parentIds]);
    return rows;
}
async function updateComment(db, id, content) {
    const { rows } = await db.query('UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [content, id]);
    return rows[0];
}
async function softDeleteComment(db, id) {
    await db.query('UPDATE comments SET deleted_at = NOW() WHERE id = $1', [id]);
}
async function resolveComment(db, id) {
    const { rows } = await db.query('UPDATE comments SET is_resolved = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *', [id]);
    return rows[0];
}
async function addReaction(db, commentId, userId, emoji) {
    await db.query('INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [commentId, userId, emoji]);
}
async function removeReaction(db, commentId, userId, emoji) {
    await db.query('DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3', [commentId, userId, emoji]);
}
async function getReplies(db, parentId) {
    return listReplies(db, [parentId]);
}
async function createReply(db, input) {
    return createComment(db, {
        taskId: input.taskId,
        docId: input.docId,
        userId: input.userId,
        content: input.content,
        parentId: input.parentId,
    });
}
export function createCommentRepository(db) {
    return {
        getTaskWithWorkspace: (taskId) => getTaskWithWorkspace(db, taskId),
        getDocWithWorkspace: (docId) => getDocWithWorkspace(db, docId),
        createComment: (input) => createComment(db, input),
        getComment: (id) => getComment(db, id),
        listRootComments: (taskId) => listRootComments(db, taskId),
        listRootDocComments: (docId) => listRootDocComments(db, docId),
        listReplies: (parentIds) => listReplies(db, parentIds),
        getReplies: (parentId) => getReplies(db, parentId),
        createReply: (input) => createReply(db, input),
        updateComment: (id, content) => updateComment(db, id, content),
        softDeleteComment: (id) => softDeleteComment(db, id),
        resolveComment: (id) => resolveComment(db, id),
        addReaction: (commentId, userId, emoji) => addReaction(db, commentId, userId, emoji),
        removeReaction: (commentId, userId, emoji) => removeReaction(db, commentId, userId, emoji),
    };
}
//# sourceMappingURL=comments.repository.js.map