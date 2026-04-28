import { Request, Response } from 'express'
import { Pool } from 'pg'
import {
  validate,
  asyncHandler
} from '@clickup/sdk'
import {
  CreateCommentSchema,
  UpdateCommentSchema,
  AddReactionSchema
} from '@clickup/contracts'
import { createCommentService } from './comments.service.js'

export function createCommentHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params
    const { content, parentId } = validate(CreateCommentSchema, req.body)
    const comment = await service.createComment(taskId!, req.auth!.userId, content, parentId || null, req.headers['x-trace-id'] as string)
    res.status(201).json({ data: comment })
  })
}

export function listCommentsHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params
    const comments = await service.listComments(taskId!, req.auth!.userId, req.headers['x-trace-id'] as string)
    res.json({ data: comments })
  })
}

export function listCommentsByQueryHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.query['taskId'] as string | undefined
    if (!taskId) {
      res.status(400).json({ error: 'taskId query param required' })
      return
    }
    const comments = await service.listComments(taskId, req.auth!.userId, req.headers['x-trace-id'] as string)
    res.json({ data: comments })
  })
}

export function createDocCommentHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const { content, parentId } = validate(CreateCommentSchema, req.body)
    const comment = await service.createDocComment(docId!, req.auth!.userId, content, parentId || null, req.headers['x-trace-id'] as string)
    res.status(201).json({ data: comment })
  })
}

export function listDocCommentsHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const comments = await service.listDocComments(docId!, req.auth!.userId, req.headers['x-trace-id'] as string)
    res.json({ data: comments })
  })
}

export function updateCommentHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    const { content } = validate(UpdateCommentSchema, req.body)
    const comment = await service.updateComment(commentId!, req.auth!.userId, content)
    res.json({ data: comment })
  })
}

export function deleteCommentHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    await service.deleteComment(commentId!, req.auth!.userId, req.headers['x-trace-id'] as string)
    res.status(204).end()
  })
}

export function resolveCommentHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    const comment = await service.resolveComment(commentId!, req.auth!.userId)
    res.json({ data: comment })
  })
}

export function addReactionHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    const { emoji } = validate(AddReactionSchema, req.body)
    await service.addReaction(commentId!, req.auth!.userId, emoji)
    res.status(201).json({ data: { commentId, userId: req.auth!.userId, emoji } })
  })
}

export function removeReactionHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId, emoji } = req.params
    await service.removeReaction(commentId!, req.auth!.userId, emoji!)
    res.status(204).end()
  })
}

export function createReplyHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    const { content } = validate(CreateCommentSchema, req.body)
    const reply = await service.createReply(commentId!, req.auth!.userId, content, req.headers['x-trace-id'] as string)
    res.status(201).json({ data: reply })
  })
}

export function getRepliesHandler(db: Pool) {
  const service = createCommentService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { commentId } = req.params
    const replies = await service.getReplies(commentId!, req.auth!.userId, req.headers['x-trace-id'] as string)
    res.json({ data: replies })
  })
}
