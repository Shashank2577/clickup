import { Request, Response } from 'express'
import { Pool } from 'pg'
import {
  validate,
  asyncHandler,
  AppError,
  publish,
} from '@clickup/sdk'
import {
  AddMessageReactionSchema,
  ErrorCode,
  CHAT_EVENTS,
} from '@clickup/contracts'
import { createMessageRepository } from './messages.repository.js'

export function addReactionHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params
    const { emoji } = validate(AddMessageReactionSchema, req.body)
    const userId = req.auth!.userId

    const message = await repo.getMessageRaw(messageId!)
    if (!message) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    // Verify the user has access to the channel
    const channel = await repo.getChannel(message.channel_id)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'public') {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    } else {
      const isMember = await repo.isChannelMember(message.channel_id, userId)
      if (!isMember) throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED)
    }

    await repo.addReaction(messageId!, userId, emoji)

    await publish(CHAT_EVENTS.REACTION_ADDED as any, {
      messageId: message.id,
      channelId: message.channel_id,
      workspaceId: channel.workspace_id,
      userId,
      emoji,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(201).json({ data: { messageId, userId, emoji } })
  })
}

export function removeReactionHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId, emoji } = req.params
    const userId = req.auth!.userId

    const message = await repo.getMessageRaw(messageId!)
    if (!message) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    // Verify channel access
    const channel = await repo.getChannel(message.channel_id)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'public') {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    } else {
      const isMember = await repo.isChannelMember(message.channel_id, userId)
      if (!isMember) throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED)
    }

    await repo.removeReaction(messageId!, userId, emoji!)

    await publish(CHAT_EVENTS.REACTION_REMOVED as any, {
      messageId: message.id,
      channelId: message.channel_id,
      workspaceId: channel.workspace_id,
      userId,
      emoji: emoji!,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(204).end()
  })
}
