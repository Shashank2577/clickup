import { Request, Response } from 'express'
import { Pool } from 'pg'
import {
  validate,
  asyncHandler,
  AppError,
} from '@clickup/sdk'
import {
  ThreadListQuerySchema,
  ErrorCode,
} from '@clickup/contracts'
import { createMessageRepository } from './messages.repository.js'

export function listThreadRepliesHandler(db: Pool) {
  const repo = createMessageRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params
    const query = validate(ThreadListQuerySchema, req.query)
    const userId = req.auth!.userId

    // Verify the parent message exists
    const parent = await repo.getMessageRaw(messageId!)
    if (!parent) throw new AppError(ErrorCode.MESSAGE_NOT_FOUND)

    // Verify the user has access to the channel
    const channel = await repo.getChannel(parent.channel_id)
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND)

    if (channel.type === 'public') {
      const wsMember = await repo.getWorkspaceMember(channel.workspace_id, userId)
      if (!wsMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    } else {
      const isMember = await repo.isChannelMember(parent.channel_id, userId)
      if (!isMember) throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED)
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50
    const offset = (page - 1) * pageSize

    const { replies, total } = await repo.listThreadReplies(messageId!, pageSize, offset)

    // Also return the parent message enriched
    const parentEnriched = await repo.getMessage(messageId!)

    res.json({
      data: {
        parent: parentEnriched,
        replies,
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })
}
