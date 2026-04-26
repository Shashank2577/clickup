import { Pool } from 'pg'

export interface CreateChannelInput {
  workspaceId: string
  spaceId: string | null
  name: string
  description: string | null
  type: 'public' | 'private' | 'direct'
  createdBy: string
}

async function createChannel(db: Pool, input: CreateChannelInput): Promise<any> {
  const { rows } = await db.query(
    `INSERT INTO channels (workspace_id, space_id, name, description, type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.workspaceId, input.spaceId, input.name, input.description, input.type, input.createdBy],
  )
  return rows[0]
}

async function getChannel(db: Pool, id: string): Promise<any | null> {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS creator_name, u.avatar_url AS creator_avatar,
       (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS member_count
     FROM channels c
     JOIN users u ON u.id = c.created_by
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id],
  )
  return rows[0] || null
}

async function listChannels(
  db: Pool,
  workspaceId: string,
  type: string | undefined,
  limit: number,
  offset: number,
): Promise<{ channels: any[]; total: number }> {
  const conditions = ['c.workspace_id = $1', 'c.deleted_at IS NULL']
  const params: any[] = [workspaceId]

  if (type) {
    params.push(type)
    conditions.push('c.type = $' + params.length)
  }

  const whereClause = conditions.join(' AND ')

  const countQuery = `SELECT COUNT(*) FROM channels c WHERE ${whereClause}`
  const { rows: countRows } = await db.query(countQuery, params)
  const total = parseInt(countRows[0].count, 10)

  const dataQuery = `SELECT c.*, u.name AS creator_name, u.avatar_url AS creator_avatar,
    (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS member_count
    FROM channels c
    JOIN users u ON u.id = c.created_by
    WHERE ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

  const { rows } = await db.query(dataQuery, [...params, limit, offset])
  return { channels: rows, total }
}

async function updateChannel(db: Pool, id: string, updates: Record<string, unknown>): Promise<any> {
  const fields = Object.keys(updates)
  if (fields.length === 0) return getChannel(db, id)

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const { rows } = await db.query(
    `UPDATE channels SET ${setClause}, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id, ...Object.values(updates)],
  )
  return rows[0]
}

async function softDeleteChannel(db: Pool, id: string): Promise<void> {
  await db.query('UPDATE channels SET deleted_at = NOW() WHERE id = $1', [id])
}

// ── Membership ────────────────────────────────────────────────────────────────

async function addMember(db: Pool, channelId: string, userId: string, role: string = 'member'): Promise<any> {
  const { rows } = await db.query(
    `INSERT INTO channel_members (channel_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (channel_id, user_id) DO NOTHING
     RETURNING *`,
    [channelId, userId, role],
  )
  return rows[0] || null
}

async function removeMember(db: Pool, channelId: string, userId: string): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId],
  )
  return (result.rowCount ?? 0) > 0
}

async function getMember(db: Pool, channelId: string, userId: string): Promise<any | null> {
  const { rows } = await db.query(
    'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId],
  )
  return rows[0] || null
}

async function listMembers(db: Pool, channelId: string): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT cm.*, u.name, u.email, u.avatar_url
     FROM channel_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.channel_id = $1
     ORDER BY cm.joined_at ASC`,
    [channelId],
  )
  return rows
}

async function isMember(db: Pool, channelId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId],
  )
  return rows.length > 0
}

// ── DM Channels ───────────────────────────────────────────────────────────────

async function findDMChannel(db: Pool, workspaceId: string, participantIds: string[]): Promise<any | null> {
  // Find an existing DM channel in this workspace that has exactly these participants
  const sorted = [...participantIds].sort()
  const { rows } = await db.query(
    `SELECT c.id FROM channels c
     WHERE c.workspace_id = $1 AND c.type = 'direct' AND c.deleted_at IS NULL
     AND (
       SELECT array_agg(cm.user_id ORDER BY cm.user_id)
       FROM channel_members cm WHERE cm.channel_id = c.id
     ) = $2::uuid[]`,
    [workspaceId, sorted],
  )
  if (rows.length === 0) return null
  return getChannel(db, rows[0].id)
}

async function listDMChannels(db: Pool, workspaceId: string, userId: string): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT c.*, u.name AS creator_name, u.avatar_url AS creator_avatar,
       (SELECT COUNT(*) FROM channel_members cm2 WHERE cm2.channel_id = c.id) AS member_count,
       (SELECT json_agg(jsonb_build_object('userId', u2.id, 'name', u2.name, 'avatarUrl', u2.avatar_url))
        FROM channel_members cm3 JOIN users u2 ON u2.id = cm3.user_id
        WHERE cm3.channel_id = c.id AND cm3.user_id != $2) AS other_participants
     FROM channels c
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
     JOIN users u ON u.id = c.created_by
     WHERE c.workspace_id = $1 AND c.type = 'direct' AND c.deleted_at IS NULL
     ORDER BY c.updated_at DESC`,
    [workspaceId, userId],
  )
  return rows
}

async function getWorkspaceMember(db: Pool, workspaceId: string, userId: string): Promise<any | null> {
  const { rows } = await db.query(
    'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  )
  return rows[0] || null
}

export function createChannelRepository(db: Pool) {
  return {
    createChannel: (input: CreateChannelInput) => createChannel(db, input),
    getChannel: (id: string) => getChannel(db, id),
    listChannels: (workspaceId: string, type: string | undefined, limit: number, offset: number) =>
      listChannels(db, workspaceId, type, limit, offset),
    updateChannel: (id: string, updates: Record<string, unknown>) => updateChannel(db, id, updates),
    softDeleteChannel: (id: string) => softDeleteChannel(db, id),

    addMember: (channelId: string, userId: string, role?: string) => addMember(db, channelId, userId, role),
    removeMember: (channelId: string, userId: string) => removeMember(db, channelId, userId),
    getMember: (channelId: string, userId: string) => getMember(db, channelId, userId),
    listMembers: (channelId: string) => listMembers(db, channelId),
    isMember: (channelId: string, userId: string) => isMember(db, channelId, userId),

    findDMChannel: (workspaceId: string, participantIds: string[]) => findDMChannel(db, workspaceId, participantIds),
    listDMChannels: (workspaceId: string, userId: string) => listDMChannels(db, workspaceId, userId),
    getWorkspaceMember: (workspaceId: string, userId: string) => getWorkspaceMember(db, workspaceId, userId),
  }
}
