import { Router } from 'express'
import { Pool } from 'pg'
import { requireAuth } from '@clickup/sdk'
import {
  createChannelHandler,
  getChannelHandler,
  listChannelsHandler,
  updateChannelHandler,
  deleteChannelHandler,
  joinChannelHandler,
  leaveChannelHandler,
  inviteToChannelHandler,
  listChannelMembersHandler,
  createDMChannelHandler,
  listDMChannelsHandler,
} from './channels/channels.handler.js'
import {
  createMessageHandler,
  listMessagesHandler,
  getMessageHandler,
  updateMessageHandler,
  deleteMessageHandler,
} from './messages/messages.handler.js'
import {
  addReactionHandler,
  removeReactionHandler,
} from './messages/reactions.handler.js'
import {
  listThreadRepliesHandler,
} from './messages/threads.handler.js'

export function createRouter(db: Pool): Router {
  const router = Router()

  // ── Channel CRUD ──────────────────────────────────────────────────────────
  router.post('/channels', requireAuth, createChannelHandler(db))
  router.get('/channels', requireAuth, listChannelsHandler(db))
  router.get('/channels/:channelId', requireAuth, getChannelHandler(db))
  router.patch('/channels/:channelId', requireAuth, updateChannelHandler(db))
  router.delete('/channels/:channelId', requireAuth, deleteChannelHandler(db))

  // ── Channel Membership ────────────────────────────────────────────────────
  router.post('/channels/:channelId/join', requireAuth, joinChannelHandler(db))
  router.post('/channels/:channelId/leave', requireAuth, leaveChannelHandler(db))
  router.post('/channels/:channelId/invite', requireAuth, inviteToChannelHandler(db))
  router.get('/channels/:channelId/members', requireAuth, listChannelMembersHandler(db))

  // ── Direct Messages ───────────────────────────────────────────────────────
  router.post('/dm', requireAuth, createDMChannelHandler(db))
  router.get('/dm', requireAuth, listDMChannelsHandler(db))

  // ── Messages ──────────────────────────────────────────────────────────────
  router.post('/channels/:channelId/messages', requireAuth, createMessageHandler(db))
  router.get('/channels/:channelId/messages', requireAuth, listMessagesHandler(db))
  router.get('/messages/:messageId', requireAuth, getMessageHandler(db))
  router.patch('/messages/:messageId', requireAuth, updateMessageHandler(db))
  router.delete('/messages/:messageId', requireAuth, deleteMessageHandler(db))

  // ── Reactions ─────────────────────────────────────────────────────────────
  router.post('/messages/:messageId/reactions', requireAuth, addReactionHandler(db))
  router.delete('/messages/:messageId/reactions/:emoji', requireAuth, removeReactionHandler(db))

  // ── Threads ───────────────────────────────────────────────────────────────
  router.get('/messages/:messageId/thread', requireAuth, listThreadRepliesHandler(db))

  return router
}
