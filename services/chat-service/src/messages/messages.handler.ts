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
  CreateMessageSchema,
  UpdateMessageSchema,
  MessageListQuerySchema,
  ErrorCode,
  CHAT_EVENTS,
} from '@clickup/contracts'
import { createMessageRepository } from './messages.repository.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractMentions(content: string): string[] {
  const matches = content.matchAll(/@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g)
  return [...matches].map(m => m[1]).filter((id): id is string => id !== undefined)
}

async function verifyChannelMembership(
  repo: ReturnType<typeof createMessageRepository>,
  channelId: string,
  userId: string,
): Promise<any> {
  const channel = await repo.getChannel(channelId)
  if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

  if (channel.type === 'public') {
    // For public channels, workspace membership is sufficient to read
    const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
    if (!wsMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  } else {
    // For private/DM, must be a channel member
    const isMember = await repo.isChannelMember(channelId, userId)
    if (!isMember) throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED)
  }

  return channel
}

async function verifyChannelMembershipForWrite(
  repo: ReturnType<typeof createMessageRepository>,
  channelId: string,
  userId: string,
): Promise<any> {
  const channel = await repo.getChannel(channelId)
  if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

  // Writing always requires channel membership
  const isMember = await repo.isChannelMember(channelId, userId)
  if (!isMember) throw new AppError(ErrorCode.CHANNEL_NOT_MEMBER, 'You must be a channel member to post messages')

  return channel
}

// ── Message CRUD ────────────────────────────────────────────────────────────

export function createMessageHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const input = validate(CreateMessageSchema, req.body)
    const userId = req.auth!.userId

    const channel = await verifyChannelMembershipForWrite(repo, channelId!, userId)

    // If this is a thread reply, verify the parent exists in this channel
    if (input.threadParentId) {
      const parent = await repo.getMessageRaw(input.threadParentId)
      if (!parent || parent.channel_id !== channelId) {
        throw new AppError(ErrorCode.MESSAGE_NOT_FOUND, 'Thread parent message not found in this channel')
      }
      // Only allow one level of threading
      if (parent.thread_parent_id !== null) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Cannot reply to a thread reply — only one level of threading is supported')
      }
    }

    const message = await repo.createMessage({
      channelId: channelId!,
      senderId: userId,
      content: input.content,
      type: 'text',
      threadParentId: input.threadParentId || null,
    })

    // Parse and save mentions
    const mentionedUserIds = extractMentions(input.content)
    if (mentionedUserIds.length > 0) {
      await repo.saveMentions(message.id, mentionedUserIds)
    }

    // Touch channel updated_at for ordering
    await repo.touchChannel(channelId!)

    // Publish events
    await publish(CHAT_EVENTS.MESSAGE_CREATED as any, {
      messageId: message.id,
      channelId: message.channel_id,
      workspaceId: channel.workspace_id,
      senderId: userId,
      content: message.content,
      threadParentId: message.thread_parent_id,
      mentionedUserIds,
      occurredAt: new Date().toISOString(),
    } as any)

    if (mentionedUserIds.length > 0) {
      await publish(CHAT_EVENTS.MENTIONED as any, {
        messageId: message.id,
        channelId: message.channel_id,
        workspaceId: channel.workspace_id,
        authorId: userId,
        mentionedUserIds,
        content: message.content,
        occurredAt: new Date().toISOString(),
      } as any)
      logger.info({ messageId: message.id, mentionedUserIds }, 'chat.mentioned event published')
    }

    // Return enriched message
    const enriched = await repo.getMessage(message.id)
    res.status(201).json({ data: enriched })
  })
}

export function listMessagesHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params
    const query = validate(MessageListQuerySchema, req.query)
    const userId = req.auth!.userId

    await verifyChannelMembership(repo, channelId!, userId)

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50
    const offset = (page - 1) * pageSize

    const { messages, total } = await repo.listMessages(channelId!, pageSize, offset)

    res.json({
      data: messages,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })
}

export function getMessageHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params
    const userId = req.auth!.userId

    const message = await repo.getMessage(messageId!)
    if (!message) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    await verifyChannelMembership(repo, message.channel_id, userId)

    res.json({ data: message })
  })
}

export function updateMessageHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params
    const { content } = validate(UpdateMessageSchema, req.body)
    const userId = req.auth!.userId

    const message = await repo.getMessageRaw(messageId!)
    if (!message) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    // Only the sender can edit their own messages
    if (message.sender_id !== userId) {
      throw new AppError(ErrorCode.MESSAGE_CANNOT_EDIT_OTHERS)
    }

    const updated = await repo.updateMessage(messageId!, content)
    const channel = await repo.getChannel(message.channel_id)

    // Re-parse mentions from updated content
    const mentionedUserIds = extractMentions(content)
    if (mentionedUserIds.length > 0) {
      await repo.saveMentions(messageId!, mentionedUserIds)
    }

    await publish(CHAT_EVENTS.MESSAGE_UPDATED as any, {
      messageId: updated.id,
      channelId: updated.channel_id,
      workspaceId: channel?.workspace_id,
      updatedBy: userId,
      content: updated.content,
      occurredAt: new Date().toISOString(),
    } as any)

    if (mentionedUserIds.length > 0) {
      await publish(CHAT_EVENTS.MENTIONED as any, {
        messageId: updated.id,
        channelId: updated.channel_id,
        workspaceId: channel?.workspace_id,
        authorId: userId,
        mentionedUserIds,
        content: updated.content,
        occurredAt: new Date().toISOString(),
      } as any)
    }

    const enriched = await repo.getMessage(messageId!)
    res.json({ data: enriched })
  })
}

export function deleteMessageHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params
    const userId = req.auth!.userId

    const message = await repo.getMessageRaw(messageId!)
    if (!message) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    const channel = await repo.getChannel(message.channel_id)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    // Sender can delete their own messages; workspace admins can delete any
    if (message.sender_id !== userId) {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember || !['owner', 'admin'].includes(wsMember.role)) {
        throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
      }
    }

    await repo.softDeleteMessage(messageId!)

    await publish(CHAT_EVENTS.MESSAGE_DELETED as any, {
      messageId: message.id,
      channelId: message.channel_id,
      workspaceId: channel.workspace_id,
      deletedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(204).end()
  })
}
