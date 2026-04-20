import { Pool, PoolClient } from 'pg'

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  owner_id: string
  logo_url: string | null
  created_at: Date
}

interface MemberRow {
  workspace_id: string
  user_id: string
  role: string
  joined_at: Date
}

export class WorkspacesRepository {
  constructor(private readonly db: Pool) {}

  async getWorkspaceBySlug(slug: string): Promise<WorkspaceRow | null> {
    const r = await this.db.query<WorkspaceRow>(
      `SELECT id, name, slug, owner_id, logo_url, created_at FROM workspaces WHERE slug = $1 AND deleted_at IS NULL`,
      [slug],
    )
    return r.rows[0] ?? null
  }

  async createWorkspace(
    client: PoolClient,
    input: { name: string; slug: string; ownerId: string },
  ): Promise<WorkspaceRow> {
    const r = await client.query<WorkspaceRow>(
      `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3)
       RETURNING id, name, slug, owner_id, logo_url, created_at`,
      [input.name, input.slug, input.ownerId],
    )
    return r.rows[0]!
  }

  async addMember(
    client: PoolClient | Pool,
    input: { workspaceId: string; userId: string; role: string },
  ): Promise<MemberRow> {
    const r = await client.query<MemberRow>(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING workspace_id, user_id, role, joined_at`,
      [input.workspaceId, input.userId, input.role],
    )
    return r.rows[0]!
  }

  async getWorkspace(id: string): Promise<WorkspaceRow | null> {
    const r = await this.db.query<WorkspaceRow>(
      `SELECT id, name, slug, owner_id, logo_url, created_at FROM workspaces WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getUserWorkspaces(userId: string): Promise<Array<WorkspaceRow & { role: string; joined_at: Date }>> {
    const r = await this.db.query<WorkspaceRow & { role: string; joined_at: Date }>(
      `SELECT w.id, w.name, w.slug, w.owner_id, w.logo_url, w.created_at, wm.role, wm.joined_at
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.deleted_at IS NULL
       ORDER BY wm.joined_at ASC`,
      [userId],
    )
    return r.rows
  }

  async updateWorkspace(id: string, input: { name?: string; logoUrl?: string | null }): Promise<WorkspaceRow> {
    const r = await this.db.query<WorkspaceRow>(
      `UPDATE workspaces
       SET name = COALESCE($2, name), logo_url = COALESCE($3, logo_url)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, name, slug, owner_id, logo_url, created_at`,
      [id, input.name ?? null, input.logoUrl ?? null],
    )
    return r.rows[0]!
  }

  async getMember(workspaceId: string, userId: string): Promise<MemberRow | null> {
    const r = await this.db.query<MemberRow>(
      `SELECT workspace_id, user_id, role, joined_at FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }

  async getMembers(workspaceId: string): Promise<MemberRow[]> {
    const r = await this.db.query<MemberRow>(
      `SELECT workspace_id, user_id, role, joined_at FROM workspace_members
       WHERE workspace_id = $1 ORDER BY joined_at ASC`,
      [workspaceId],
    )
    return r.rows
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
  }

  async updateMemberRole(workspaceId: string, userId: string, role: string): Promise<void> {
    await this.db.query(
      `UPDATE workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId, role],
    )
  }

  async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const r = await this.db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    )
    return r.rows[0] ?? null
  }
}
