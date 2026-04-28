import { z } from 'zod'

const uuid = z.string().uuid()

// ── Channels ────────────────────────────────────────────────────────────────

export const CreateChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(200, 'Channel name too long'),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().min(1),
  spaceId: uuid.optional(),
  type: z.enum(['public', 'private', 'direct']).default('public'),
})

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
})

export const ChannelListQuerySchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(['public', 'private', 'direct']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
})

// ── Channel Membership ──────────────────────────────────────────────────────

export const InviteToChannelSchema = z.object({
  userId: uuid,
})

// ── Messages ────────────────────────────────────────────────────────────────

export const CreateMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  threadParentId: uuid.optional(),
})

export const UpdateMessageSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const MessageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
})

export const ThreadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
})

// ── Reactions ───────────────────────────────────────────────────────────────

export const AddMessageReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

// ── Direct Messages ─────────────────────────────────────────────────────────

export const CreateDMChannelSchema = z.object({
  workspaceId: z.string().min(1),
  participantIds: z.array(uuid).min(1, 'At least one participant is required').max(8),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>
export type ChannelListQuery = z.infer<typeof ChannelListQuerySchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>
export type CreateDMChannelInput = z.infer<typeof CreateDMChannelSchema>
