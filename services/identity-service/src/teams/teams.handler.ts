import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate, AppError, tier2Del, CacheKeys } from '@clickup/sdk'
import { ErrorCode, CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema } from '@clickup/contracts'
import { TeamsRepository } from './teams.repository.js'

function toTeamDto(row: {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_by: string
  created_at: Date
}) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }
}

function toMemberDto(row: {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  joined_at: Date
}) {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    joinedAt: row.joined_at.toISOString(),
  }
}

export function teamsRoutes(db: Pool): Router {
  const router = Router()
  const repository = new TeamsRepository(db)

  // POST /teams — create team
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(CreateTeamSchema, req.body)
      const member = await repository.getWorkspaceMember(input.workspaceId, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const team = await repository.createTeam({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        createdBy: req.auth.userId,
      })
      // Auto-add creator as first member
      await repository.addMember(team.id, req.auth.userId)
      await tier2Del(CacheKeys.teamList(input.workspaceId))
      res.status(201).json({ data: toTeamDto(team) })
    }),
  )

  // GET /teams?workspaceId=... — list teams in workspace
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const workspaceId = req.query['workspaceId'] as string
      if (!workspaceId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId query param is required')
      const member = await repository.getWorkspaceMember(workspaceId, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const teams = await repository.getTeamsByWorkspace(workspaceId)
      res.json({ data: teams.map(toTeamDto) })
    }),
  )

  // GET /teams/:id — get team details with members
  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const team = await repository.getTeam(id)
      if (!team) throw new AppError(ErrorCode.TEAM_NOT_FOUND)
      const member = await repository.getWorkspaceMember(team.workspace_id, req.auth.userId)
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

      const members = await repository.getTeamMembers(id)
      res.json({
        data: {
          ...toTeamDto(team),
          members: members.map(toMemberDto),
        },
      })
    }),
  )

  // PATCH /teams/:id — update team
  router.patch(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const team = await repository.getTeam(id)
      if (!team) throw new AppError(ErrorCode.TEAM_NOT_FOUND)
      const wsMember = await repository.getWorkspaceMember(team.workspace_id, req.auth.userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const input = validate(UpdateTeamSchema, req.body)
      const updated = await repository.updateTeam(id, input)
      await tier2Del(CacheKeys.team(id))
      await tier2Del(CacheKeys.teamList(team.workspace_id))
      res.json({ data: toTeamDto(updated) })
    }),
  )

  // DELETE /teams/:id — soft delete team
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const team = await repository.getTeam(id)
      if (!team) throw new AppError(ErrorCode.TEAM_NOT_FOUND)
      const wsMember = await repository.getWorkspaceMember(team.workspace_id, req.auth.userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      await repository.softDeleteTeam(id)
      await tier2Del(CacheKeys.team(id))
      await tier2Del(CacheKeys.teamList(team.workspace_id))
      res.status(204).end()
    }),
  )

  // POST /teams/:id/members — add member to team
  router.post(
    '/:id/members',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = req.params
      if (!id) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'id is required')
      const team = await repository.getTeam(id)
      if (!team) throw new AppError(ErrorCode.TEAM_NOT_FOUND)
      const wsMember = await repository.getWorkspaceMember(team.workspace_id, req.auth.userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const input = validate(AddTeamMemberSchema, req.body)

      // Verify user is a workspace member
      const isWsMember = await repository.isWorkspaceMember(team.workspace_id, input.userId)
      if (!isWsMember) throw new AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND)

      const existing = await repository.getMember(id, input.userId)
      if (existing) throw new AppError(ErrorCode.TEAM_MEMBER_ALREADY_EXISTS)

      await repository.addMember(id, input.userId)
      await tier2Del(CacheKeys.team(id))
      res.status(201).json({ data: { teamId: id, userId: input.userId } })
    }),
  )

  // DELETE /teams/:id/members/:userId — remove member from team
  router.delete(
    '/:id/members/:userId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id, userId } = req.params
      if (!id || !userId) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required')
      const team = await repository.getTeam(id)
      if (!team) throw new AppError(ErrorCode.TEAM_NOT_FOUND)
      const wsMember = await repository.getWorkspaceMember(team.workspace_id, req.auth.userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

      const existing = await repository.getMember(id, userId)
      if (!existing) throw new AppError(ErrorCode.TEAM_MEMBER_NOT_FOUND)

      await repository.removeMember(id, userId)
      await tier2Del(CacheKeys.team(id))
      res.status(204).end()
    }),
  )

  return router
}
