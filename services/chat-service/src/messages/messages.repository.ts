import { Pool } from 'pg'

export interface CreateMessageInput {
  channelId: string
  senderId: string
  content: string
  type: 'text' | 'system'
  threadParentId: string | null
}

// ── Messages ────────────────────────────────────────────────────────────────

async function createMessage(db: Pool, input: CreateMessageInput): Promise<any> {
  const { rows } = await db.query(
    `INSERT INTO chat_messages (channel_id, sender_id, content, type, thread_parent_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.channelId, input.senderId, input.content, input.type, input.threadParentId],
  )
  return rows[0]
}

async function getMessage(db: Pool, id: string): Promise<any | null> {
  const { rows } = await db.query(
    `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar,
       json_agg(DISTINCT jsonb_build_object('messageId', mr.message_id, 'userId', mr.user_id, 'emoji', mr.emoji))
       FILTER (WHERE mr.message_id IS NOT NULL) AS reactions
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN message_reactions mr ON mr.message_id = m.id
     WHERE m.id = $1 AND m.deleted_at IS NULL
     GROUP BY m.id, u.name, u.avatar_url`,
    [id],
  )
  return rows[0] || null
}

async function getMessageRaw(db: Pool, id: string): Promise<any | null> {
  const { rows } = await db.query(
    'SELECT * FROM chat_messages WHERE id = $1 AND deleted_at IS NULL',
    [id],
  )
  return rows[0] || null
}

async function listMessages(
  db: Pool,
  channelId: string,
  limit: number,
  offset: number,
): Promise<{ messages: any[]; total: number }> {
  const countQuery = `SELECT COUNT(*) FROM chat_messages
    WHERE channel_id = $1 AND thread_parent_id IS NULL AND deleted_at IS NULL`
  const { rows: countRows } = await db.query(countQuery, [channelId])
  const total = parseInt(countRows[0].count, 10)

  const dataQuery = `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar,
    json_agg(DISTINCT jsonb_build_object('messageId', mr.message_id, 'userId', mr.user_id, 'emoji', mr.emoji))
    FILTER (WHERE mr.message_id IS NOT NULL) AS reactions
    FROM chat_messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN message_reactions mr ON mr.message_id = m.id
    WHERE m.channel_id = $1 AND m.thread_parent_id IS NULL AND m.deleted_at IS NULL
    GROUP BY m.id, u.name, u.avatar_url
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3`

  const { rows } = await db.query(dataQuery, [channelId, limit, offset])
  return { messages: rows, total }
}

async function updateMessage(db: Pool, id: string, content: string): Promise<any> {
  const { rows } = await db.query(
    `UPDATE chat_messages SET content = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
    [content, id],
  )
  return rows[0]
}

async function softDeleteMessage(db: Pool, id: string): Promise<void> {
  await db.query('UPDATE chat_messages SET deleted_at = NOW() WHERE id = $1', [id])
}

// ── Thread Replies ──────────────────────────────────────────────────────────

async function listThreadReplies(
  db: Pool,
  parentId: string,
  limit: number,
  offset: number,
): Promise<{ replies: any[]; total: number }> {
  const countQuery = `SELECT COUNT(*) FROM chat_messages
    WHERE thread_parent_id = $1 AND deleted_at IS NULL`
  const { rows: countRows } = await db.query(countQuery, [parentId])
  const total = parseInt(countRows[0].count, 10)

  const dataQuery = `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar,
    json_agg(DISTINCT jsonb_build_object('messageId', mr.message_id, 'userId', mr.user_id, 'emoji', mr.emoji))
    FILTER (WHERE mr.message_id IS NOT NULL) AS reactions
    FROM chat_messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN message_reactions mr ON mr.message_id = m.id
    WHERE m.thread_parent_id = $1 AND m.deleted_at IS NULL
    GROUP BY m.id, u.name, u.avatar_url
    ORDER BY m.created_at ASC
    LIMIT $2 OFFSET $3`

  const { rows } = await db.query(dataQuery, [parentId, limit, offset])
  return { replies: rows, total }
}

// ── Reactions ───────────────────────────────────────────────────────────────

async function addReaction(db: Pool, messageId: string, userId: string, emoji: string): Promise<void> {
  await db.query(
    `INSERT INTO message_reactions (message_id, user_id, emoji)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [messageId, userId, emoji],
  )
}

async function removeReaction(db: Pool, messageId: string, userId: string, emoji: string): Promise<void> {
  await db.query(
    'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, userId, emoji],
  )
}

// ── Mentions ────────────────────────────────────────────────────────────────

async function saveMentions(db: Pool, messageId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const values = userIds.map((_, i) => `($1, $${i + 2})`).join(', ')
  await db.query(
    `INSERT INTO chat_mentions (message_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [messageId, ...userIds],
  )
}

// ── Channel helpers ─────────────────────────────────────────────────────────

async function getChannel(db: Pool, id: string): Promise<any | null> {
  const { rows } = await db.query(
    'SELECT * FROM channels WHERE id = $1 AND deleted_at IS NULL',
    [id],
  )
  return rows[0] || null
}

async function isChannelMember(db: Pool, channelId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId],
  )
  return rows.length > 0
}

async function getWorkspaceMember(db: Pool, workspaceId: string, userId: string): Promise<any | null> {
  const { rows } = await db.query(
    'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  )
  return rows[0] || null
}

// Update the channel's updated_at when a message is posted (for DM ordering)
async function touchChannel(db: Pool, channelId: string): Promise<void> {
  await db.query('UPDATE channels SET updated_at = NOW() WHERE id = $1', [channelId])
}

export function createMessageRepository(db: Pool) {
  return {
    createMessage: (input: CreateMessageInput) => createMessage(db, input),
    getMessage: (id: string) => getMessage(db, id),
    getMessageRaw: (id: string) => getMessageRaw(db, id),
    listMessages: (channelId: string, limit: number, offset: number) =>
      listMessages(db, channelId, limit, offset),
    updateMessage: (id: string, content: string) => updateMessage(db, id, content),
    softDeleteMessage: (id: string) => softDeleteMessage(db, id),

    listThreadReplies: (parentId: string, limit: number, offset: number) =>
      listThreadReplies(db, parentId, limit, offset),

    addReaction: (messageId: string, userId: string, emoji: string) =>
      addReaction(db, messageId, userId, emoji),
    removeReaction: (messageId: string, userId: string, emoji: string) =>
      removeReaction(db, messageId, userId, emoji),

    saveMentions: (messageId: string, userIds: string[]) => saveMentions(db, messageId, userIds),

    getChannel: (id: string) => getChannel(db, id),
    isChannelMember: (channelId: string, userId: string) => isChannelMember(db, channelId, userId),
    getWorkspaceMember: (workspaceId: string, userId: string) =>
      getWorkspaceMember(db, workspaceId, userId),
    touchChannel: (channelId: string) => touchChannel(db, channelId),
  }
}
