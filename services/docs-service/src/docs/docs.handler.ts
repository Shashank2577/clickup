import { Router } from 'express'
import { asyncHandler, validate, requireAuth } from '@clickup/sdk'
import { CreateDocSchema, UpdateDocSchema } from '@clickup/contracts'
import type { DocsService } from './docs.service.js'

// ============================================================
// Docs HTTP handler — all routes require authentication
// ============================================================

export function createDocsRouter(service: DocsService): Router {
  const router = Router()

  // ----------------------------------------------------------
  // POST /workspaces/:workspaceId/docs — create a root doc
  // ----------------------------------------------------------
  router.post(
    '/workspaces/:workspaceId/docs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = validate(CreateDocSchema, req.body)
      const doc = await service.createDoc({
        workspaceId: req.params['workspaceId']!,
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.parent_id !== undefined && { parentId: body.parent_id }),
        ...(body.is_public !== undefined && { isPublic: body.is_public }),
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.status(201).json({ data: doc })
    }),
  )

  // ----------------------------------------------------------
  // GET /workspaces/:workspaceId/docs — list top-level docs
  // ----------------------------------------------------------
  router.get(
    '/workspaces/:workspaceId/docs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const docs = await service.listDocs({
        workspaceId: req.params['workspaceId']!,
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.json({ data: docs })
    }),
  )

  // ----------------------------------------------------------
  // GET /docs/:docId — get a single doc with children
  // ----------------------------------------------------------
  router.get(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await service.getDoc({
        docId: req.params['docId']!,
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.json({ data: result })
    }),
  )

  // ----------------------------------------------------------
  // PATCH /docs/:docId — update a doc
  // ----------------------------------------------------------
  router.patch(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = validate(UpdateDocSchema, req.body)
      const doc = await service.updateDoc({
        docId: req.params['docId']!,
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.is_public !== undefined && { isPublic: body.is_public }),
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.json({ data: doc })
    }),
  )

  // ----------------------------------------------------------
  // DELETE /docs/:docId — soft-delete a doc and descendants
  // ----------------------------------------------------------
  router.delete(
    '/docs/:docId',
    requireAuth,
    asyncHandler(async (req, res) => {
      await service.deleteDoc({
        docId: req.params['docId']!,
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.status(204).end()
    }),
  )

  // ----------------------------------------------------------
  // GET /docs/:docId/pages — list immediate child pages
  // ----------------------------------------------------------
  router.get(
    '/docs/:docId/pages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pages = await service.listPages({
        docId: req.params['docId']!,
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.json({ data: pages })
    }),
  )

  // ----------------------------------------------------------
  // POST /docs/:docId/pages — create a nested page
  // ----------------------------------------------------------
  router.post(
    '/docs/:docId/pages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = validate(CreateDocSchema, req.body)
      const doc = await service.createPage({
        parentDocId: req.params['docId']!,
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.is_public !== undefined && { isPublic: body.is_public }),
        userId: req.auth.userId,
        token: req.headers.authorization!.slice(7),
      })
      res.status(201).json({ data: doc })
    }),
  )

  return router
}
