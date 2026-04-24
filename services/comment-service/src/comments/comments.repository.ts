import { Pool } from 'pg'

export interface CreateCommentInput {
  taskId: string | null
  docId: string | null
  userId: string
  content: string
  parentId: string | null
}

async function getTaskWithWorkspace(db: Pool, taskId: string): Promise<{ taskId: string, workspaceId: string } | null> {
  const { rows } = await db.query(
    'SELECT t.id AS task_id, s.workspace_id FROM tasks t JOIN lists l ON l.id = t.list_id JOIN spaces s ON s.id = l.space_id WHERE t.id = $1 AND t.deleted_at IS NULL',
    [taskId]
  )
  return rows[0] || null
}

async function getDocWithWorkspace(db: Pool, docId: string): Promise<{ docId: string, workspaceId: string } | null> {
  const { rows } = await db.query(
    'SELECT id AS doc_id, workspace_id FROM docs WHERE id = $1 AND deleted_at IS NULL',
    [docId]
  )
  return rows[0] || null
}

async function listRootDocComments(db: Pool, docId: string): Promise<any[]> {
  const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
    'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
    'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
    'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
    'WHERE c.doc_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL ' +
    'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC'

  const { rows } = await db.query(query, [docId])
  return rows
}

async function createComment(db: Pool, input: CreateCommentInput): Promise<any> {
  const { rows } = await db.query(
    'INSERT INTO comments (task_id, doc_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [input.taskId, input.docId, input.userId, input.content, input.parentId]
  )
  return rows[0]
}

async function getComment(db: Pool, id: string): Promise<any> {
  const { rows } = await db.query('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [id])
  return rows[0] || null
}

async function listRootComments(db: Pool, taskId: string): Promise<any[]> {
  const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
    'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
    'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
    'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
    'WHERE c.task_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL ' +
    'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC'
  
  const { rows } = await db.query(query, [taskId])
  return rows
}

async function listReplies(db: Pool, parentIds: string[]): Promise<any[]> {
  const query = 'SELECT c.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar, ' +
    'json_agg(DISTINCT jsonb_build_object(\'commentId\', cr.comment_id, \'userId\', cr.user_id, \'emoji\', cr.emoji)) ' +
    'FILTER (WHERE cr.comment_id IS NOT NULL) AS reactions ' +
    'FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN comment_reactions cr ON cr.comment_id = c.id ' +
    'WHERE c.parent_id = ANY($1::uuid[]) AND c.deleted_at IS NULL ' +
    'GROUP BY c.id, u.id, u.name, u.avatar_url ORDER BY c.created_at ASC'
  
  const { rows } = await db.query(query, [parentIds])
  return rows
}

async function updateComment(db: Pool, id: string, content: string): Promise<any> {
  const { rows } = await db.query(
    'UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [content, id]
  )
  return rows[0]
}

async function softDeleteComment(db: Pool, id: string): Promise<void> {
  await db.query('UPDATE comments SET deleted_at = NOW() WHERE id = $1', [id])
}

async function resolveComment(db: Pool, id: string): Promise<any> {
  const { rows } = await db.query(
    'UPDATE comments SET is_resolved = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id]
  )
  return rows[0]
}

async function addReaction(db: Pool, commentId: string, userId: string, emoji: string): Promise<void> {
  await db.query(
    'INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [commentId, userId, emoji]
  )
}

async function removeReaction(db: Pool, commentId: string, userId: string, emoji: string): Promise<void> {
  await db.query(
    'DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
    [commentId, userId, emoji]
  )
}

async function getReplies(db: Pool, parentId: string): Promise<any[]> {
  return listReplies(db, [parentId])
}

export interface CreateReplyInput {
  parentId: string
  taskId: string | null
  docId: string | null
  userId: string
  content: string
}

async function createReply(db: Pool, input: CreateReplyInput): Promise<any> {
  return createComment(db, {
    taskId: input.taskId,
    docId: input.docId,
    userId: input.userId,
    content: input.content,
    parentId: input.parentId,
  })
}

export function createCommentRepository(db: Pool) {
  return {
    getTaskWithWorkspace: (taskId: string) => getTaskWithWorkspace(db, taskId),
    getDocWithWorkspace: (docId: string) => getDocWithWorkspace(db, docId),
    createComment: (input: CreateCommentInput) => createComment(db, input),
    getComment: (id: string) => getComment(db, id),
    listRootComments: (taskId: string) => listRootComments(db, taskId),
    listRootDocComments: (docId: string) => listRootDocComments(db, docId),
    listReplies: (parentIds: string[]) => listReplies(db, parentIds),
    getReplies: (parentId: string) => getReplies(db, parentId),
    createReply: (input: CreateReplyInput) => createReply(db, input),
    updateComment: (id: string, content: string) => updateComment(db, id, content),
    softDeleteComment: (id: string) => softDeleteComment(db, id),
    resolveComment: (id: string) => resolveComment(db, id),
    addReaction: (commentId: string, userId: string, emoji: string) => addReaction(db, commentId, userId, emoji),
    removeReaction: (commentId: string, userId: string, emoji: string) => removeReaction(db, commentId, userId, emoji),
  }
}
