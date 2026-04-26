import { Request, Response } from 'express'
import { Pool } from 'pg'
import {
  validate,
  asyncHandler,
  AppError,
  publish,
  logger,
} from '@clickup/sdk'
import {
  CreateChannelSchema,
  UpdateChannelSchema,
  ChannelListQuerySchema,
  InviteToChannelSchema,
  CreateDMChannelSchema,
  ErrorCode,
  CHAT_EVENTS,
} from '@clickup/contracts'
import { createChannelRepository } from './channels.repository.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyWorkspaceMembership(
  repo: ReturnType<typeof createChannelRepository>,
  workspaceId: string,
  userId: string,
): Promise<any> {
  const member = await repo.getWorkspaceMember(workspaceId, userId)
  if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  return member
}

async function verifyChannelAccess(
  repo: ReturnType<typeof createChannelRepository>,
  channelId: string,
  userId: string,
): Promise<any> {
  const channel = await repo.getChannel(channelId)
  if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

  // For public channels, workspace membership is enough
  if (channel.type === 'public') {
    await verifyWorkspaceMembership(repo, channel.workspace_id, userId)
    return channel
  }

  // For private/DM channels, must be a member
  const isMember = await repo.isMember(channelId, userId)
  if (!isMember) throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED)
  return channel
}

// ── Channel CRUD ────────────────────────────────────────────────────────────

export function createChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateChannelSchema, req.body)
    const userId = req.auth!.userId

    await verifyWorkspaceMembership(repo, input.workspaceId, userId)

    const channel = await repo.createChannel({
      workspaceId: input.workspaceId,
      spaceId: input.spaceId || null,
      name: input.name,
      description: input.description || null,
      type: input.type ?? 'public',
      createdBy: userId,
    })

    // Creator auto-joins as admin
    await repo.addMember(channel.id, userId, 'admin')

    await publish(CHAT_EVENTS.CHANNEL_CREATED as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      name: channel.name,
      type: channel.type,
      createdBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    logger.info({ channelId: channel.id }, 'Channel created')
    res.status(201).json({ data: channel })
  })
}

export function getChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const channel = await verifyChannelAccess(repo, channelId!, req.auth!.userId)
    res.json({ data: channel })
  })
}

export function listChannelsHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const query = validate(ChannelListQuerySchema, req.query)
    const userId = req.auth!.userId

    await verifyWorkspaceMembership(repo, query.workspaceId, userId)

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50
    const offset = (page - 1) * pageSize

    const { channels, total } = await repo.listChannels(
      query.workspaceId,
      query.type,
      pageSize,
      offset,
    )

    res.json({
      data: channels,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })
}

export function updateChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const updates = validate(UpdateChannelSchema, req.body)
    const userId = req.auth!.userId

    const channel = await repo.getChannel(channelId!)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    // Only channel admins or workspace admins can update
    const member = await repo.getMember(channelId!, userId)
    if (!member || member.role !== 'admin') {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) {
        throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
      }
    }

    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates['name'] = updates.name
    if (updates.description !== undefined) dbUpdates['description'] = updates.description

    const updated = await repo.updateChannel(channelId!, dbUpdates)

    await publish(CHAT_EVENTS.CHANNEL_UPDATED as any, {
      channelId: updated.id,
      workspaceId: updated.workspace_id,
      updatedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.json({ data: updated })
  })
}

export function deleteChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const userId = req.auth!.userId

    const channel = await repo.getChannel(channelId!)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    // Only channel creator or workspace admins can delete
    if (channel.created_by !== userId) {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) {
        throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
      }
    }

    await repo.softDeleteChannel(channelId!)

    await publish(CHAT_EVENTS.CHANNEL_DELETED as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      deletedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(204).end()
  })
}

// ── Channel Membership ──────────────────────────────────────────────────────

export function joinChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const userId = req.auth!.userId

    const channel = await repo.getChannel(channelId!)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'direct') {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Cannot join a DM channel directly')
    }

    if (channel.type === 'private') {
      throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED, 'Private channels require an invite')
    }

    await verifyWorkspaceMembership(repo, channel.workspace_id, userId)

    const existing = await repo.getMember(channelId!, userId)
    if (existing) throw new AppError(ErrorCode.CHANNEL_ALREADY_MEMBER)

    const membership = await repo.addMember(channelId!, userId)

    await publish(CHAT_EVENTS.MEMBER_JOINED as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(201).json({ data: membership })
  })
}

export function leaveChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const userId = req.auth!.userId

    const channel = await repo.getChannel(channelId!)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'direct') {
      throw new AppError(ErrorCode.CHANNEL_CANNOT_LEAVE_DM, 'Cannot leave a DM channel')
    }

    const removed = await repo.removeMember(channelId!, userId)
    if (!removed) throw new AppError(ErrorCode.CHANNEL_NOT_MEMBER)

    await publish(CHAT_EVENTS.MEMBER_LEFT as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(204).end()
  })
}

export function inviteToChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const { userId: inviteeId } = validate(InviteToChannelSchema, req.body)
    const inviterId = req.auth!.userId

    const channel = await repo.getChannel(channelId!)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'direct') {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Cannot invite to a DM channel')
    }

    // Inviter must be a member
    const inviterMember = await repo.getMember(channelId!, inviterId)
    if (!inviterMember) throw new AppError(ErrorCode.CHANNEL_NOT_MEMBER)

    // Invitee must be in the workspace
    await verifyWorkspaceMembership(repo, channel.workspace_id, inviteeId)

    const existing = await repo.getMember(channelId!, inviteeId)
    if (existing) throw new AppError(ErrorCode.CHANNEL_ALREADY_MEMBER)

    const membership = await repo.addMember(channelId!, inviteeId)

    await publish(CHAT_EVENTS.MEMBER_JOINED as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      userId: inviteeId,
      invitedBy: inviterId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(201).json({ data: membership })
  })
}

export function listChannelMembersHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    await verifyChannelAccess(repo, channelId!, req.auth!.userId)
    const members = await repo.listMembers(channelId!)
    res.json({ data: members })
  })
}

// ── Direct Messages ─────────────────────────────────────────────────────────

export function createDMChannelHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateDMChannelSchema, req.body)
    const userId = req.auth!.userId

    await verifyWorkspaceMembership(repo, input.workspaceId, userId)

    // Include the current user in participants
    const allParticipants = [...new Set([userId, ...input.participantIds])]

    // Verify all participants are workspace members
    for (const pid of allParticipants) {
      if (pid === userId) continue
      await verifyWorkspaceMembership(repo, input.workspaceId, pid)
    }

    // Check if DM channel already exists with these exact participants
    const existing = await repo.findDMChannel(input.workspaceId, allParticipants)
    if (existing) {
      // Return the existing DM channel rather than erroring
      res.json({ data: existing })
      return
    }

    // Build a display name from participant names
    const dmName = 'DM'

    const channel = await repo.createChannel({
      workspaceId: input.workspaceId,
      spaceId: null,
      name: dmName,
      description: null,
      type: 'direct',
      createdBy: userId,
    })

    // Add all participants as members
    for (const pid of allParticipants) {
      await repo.addMember(channel.id, pid, 'member')
    }

    const fullChannel = await repo.getChannel(channel.id)

    await publish(CHAT_EVENTS.CHANNEL_CREATED as any, {
      channelId: channel.id,
      workspaceId: channel.workspace_id,
      name: channel.name,
      type: 'direct',
      createdBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(201).json({ data: fullChannel })
  })
}

export function listDMChannelsHandler(db: Pool) {
  const repo = createChannelRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query['workspaceId']
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query parameter is required')
    }

    const userId = req.auth!.userId
    await verifyWorkspaceMembership(repo, workspaceId, userId)

    const channels = await repo.listDMChannels(workspaceId, userId)
    res.json({ data: channels })
  })
}
