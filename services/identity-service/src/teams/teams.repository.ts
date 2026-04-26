import { Pool } from 'pg'

export interface TeamRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_by: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface TeamMemberRow {
  team_id: string
  user_id: string
  joined_at: Date
}

export interface TeamWithMembersRow extends TeamRow {
  members: Array<{
    user_id: string
    name: string
    email: string
    avatar_url: string | null
    joined_at: Date
  }>
}

export class TeamsRepository {
  constructor(private readonly db: Pool) {}

  async createTeam(input: {
    workspaceId: string
    name: string
    description?: string
    createdBy: string
  }): Promise<TeamRow> {
    const r = await this.db.query<TeamRow>(
      `INSERT INTO teams (workspace_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.workspaceId, input.name, input.description ?? null, input.createdBy],
    )
    return r.rows[0]!
  }

  async getTeam(id: string): Promise<TeamRow | null> {
    const r = await this.db.query<TeamRow>(
      `SELECT * FROM teams WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async getTeamsByWorkspace(workspaceId: string): Promise<TeamRow[]> {
    const r = await this.db.query<TeamRow>(
      `SELECT * FROM teams WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY name ASC`,
      [workspaceId],
    )
    return r.rows
  }

  async updateTeam(id: string, input: { name?: string; description?: string | null }): Promise<TeamRow> {
    const r = await this.db.query<TeamRow>(
      `UPDATE teams
       SET name = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, input.name ?? null, input.description ?? null],
    )
    return r.rows[0]!
  }

  async softDeleteTeam(id: string): Promise<void> {
    await this.db.query(
      `UPDATE teams SET deleted_at = NOW() WHERE id = $1`,
      [id],
    )
  }

  async addMember(teamId: string, userId: string): Promise<TeamMemberRow> {
    const r = await this.db.query<TeamMemberRow>(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [teamId, userId],
    )
    return r.rows[0]!
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId],
    )
  }

  async getMember(teamId: string, userId: string): Promise<TeamMemberRow | null> {
    const r = await this.db.query<TeamMemberRow>(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId],
    )
    return r.rows[0] ?? null
  }

  async getTeamMembers(teamId: string): Promise<Array<{
    user_id: string
    name: string
    email: string
    avatar_url: string | null
    joined_at: Date
  }>> {
    const r = await this.db.query<{
      user_id: string
      name: string
      email: string
      avatar_url: string | null
      joined_at: Date
    }>(
      `SELECT u.id AS user_id, u.name, u.email, u.avatar_url, tm.joined_at
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id AND u.deleted_at IS NULL
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId],
    )
    return r.rows
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<{ role: string } | null> {
    const r = await this.db.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return r.rows[0] ?? null
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return parseInt(r.rows[0]!.count, 10) > 0
  }
}
