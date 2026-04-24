import { Request, Response } from 'express'
import { Pool } from 'pg'
import {
  validate,
  asyncHandler,
  AppError,
  tier3Del,
} from '@clickup/sdk'
import {
  CreateDocSchema,
  UpdateDocSchema,
  ErrorCode,
} from '@clickup/contracts'
import { createDocsService } from './docs.service.js'
import { DocsRepository } from './docs.repository.js'

// ============================================================
// Docs Handlers — CRUD, Permissions, Share Links, Versions
// ============================================================

// ============================================================
// Core CRUD handlers
// ============================================================

export function createDocHandler(db: Pool) {
  const service = createDocsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateDocSchema, req.body) as any
    const doc = await service.createDoc(req.auth!.userId, input, req.headers['x-trace-id'] as string)
    res.status(201).json({ data: doc })
  })
}

export function getDocHandler(db: Pool) {
  const service = createDocsService(db)
  const repo = new DocsRepository(db)

  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    // Permission hierarchy:
    // 1. Workspace member → full access
    // 2. Explicit doc_permissions entry → use that role
    // 3. Valid share link → use link role
    // 4. is_public → viewer
    // 5. Otherwise → 403

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) {
      const perm = await repo.getDocPermissionForUser(docId!, userId)
      if (!perm) {
        const shareLink = await repo.getShareLink(docId!)
        const isPublic = doc.is_public
        if (!shareLink && !isPublic) {
          throw new AppError(ErrorCode.DOC_ACCESS_DENIED)
        }
        if (shareLink && shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
          if (!isPublic) throw new AppError(ErrorCode.DOC_SHARE_LINK_EXPIRED)
        }
      }
    }

    res.json({ data: doc })
  })
}

export function updateDocHandler(db: Pool) {
  const service = createDocsService(db)
  const repo = new DocsRepository(db)

  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    // Must be workspace member or have editor permission
    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) {
      const perm = await repo.getDocPermissionForUser(docId!, userId)
      if (!perm || perm.role !== 'editor') {
        throw new AppError(ErrorCode.DOC_ACCESS_DENIED)
      }
    }

    const input = validate(UpdateDocSchema, req.body) as any
    const updated = await service.updateDocMeta(userId, docId!, input, req.headers['x-trace-id'] as string)
    res.json({ data: updated })
  })
}

export function deleteDocHandler(db: Pool) {
  const service = createDocsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    await service.deleteDoc(req.auth!.userId, docId!, req.headers['x-trace-id'] as string)
    res.status(204).end()
  })
}

// ============================================================
// Public share-link access (no auth required)
// GET /shared/:token
// ============================================================

export function getSharedDocHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params

    const shareLink = await repo.getShareLinkByToken(token!)
    if (!shareLink) throw new AppError(ErrorCode.DOC_SHARE_LINK_NOT_FOUND)

    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      throw new AppError(ErrorCode.DOC_SHARE_LINK_EXPIRED)
    }

    const doc = await repo.getDoc(shareLink.docId)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    res.json({ data: doc, role: shareLink.role })
  })
}

// ============================================================
// Doc Permissions
// ============================================================

export function listDocPermissionsHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const permissions = await repo.listDocPermissions(docId!)
    res.json({ data: permissions })
  })
}

export function grantDocPermissionHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId
    const { userId: targetUserId, role } = req.body as { userId: string; role: 'viewer' | 'commenter' | 'editor' }

    if (!targetUserId) throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'userId is required')
    if (!['viewer', 'commenter', 'editor'].includes(role)) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'role must be viewer, commenter, or editor')
    }

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const perm = await repo.grantDocPermission(docId!, targetUserId, role)
    res.status(201).json({ data: perm })
  })
}

export function revokeDocPermissionHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId, userId: targetUserId } = req.params
    const actingUserId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, actingUserId)
    if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const deleted = await repo.revokeDocPermission(docId!, targetUserId!)
    if (!deleted) throw new AppError(ErrorCode.DOC_PERMISSION_NOT_FOUND)

    res.status(204).end()
  })
}

// ============================================================
// Doc Share Links
// ============================================================

export function createShareLinkHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId
    const { role = 'viewer', expiresAt } = req.body as { role?: 'viewer' | 'commenter'; expiresAt?: string }

    if (!['viewer', 'commenter'].includes(role)) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'role must be viewer or commenter')
    }

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const shareLink = await repo.upsertShareLink(docId!, role, expiresAt)
    res.status(201).json({ data: shareLink })
  })
}

export function deleteShareLinkHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const deleted = await repo.deleteShareLink(docId!)
    if (!deleted) throw new AppError(ErrorCode.DOC_SHARE_LINK_NOT_FOUND)

    res.status(204).end()
  })
}

// ============================================================
// Doc Version History
// ============================================================

export function listDocVersionsHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) {
      const perm = await repo.getDocPermissionForUser(docId!, userId)
      if (!perm) throw new AppError(ErrorCode.DOC_ACCESS_DENIED)
    }

    const versions = await repo.listDocVersions(docId!)
    res.json({ data: versions })
  })
}

export function getDocVersionHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId, versionId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) {
      const perm = await repo.getDocPermissionForUser(docId!, userId)
      if (!perm) throw new AppError(ErrorCode.DOC_ACCESS_DENIED)
    }

    const version = await repo.getDocVersion(docId!, versionId!)
    if (!version) throw new AppError(ErrorCode.DOC_VERSION_NOT_FOUND)

    res.json({ data: version })
  })
}

export function restoreDocVersionHandler(db: Pool) {
  const repo = new DocsRepository(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { docId, versionId } = req.params
    const userId = req.auth!.userId

    const doc = await repo.getDoc(docId!)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    // Must be workspace member or have editor permission
    const isMember = await repo.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) {
      const perm = await repo.getDocPermissionForUser(docId!, userId)
      if (!perm || perm.role !== 'editor') {
        throw new AppError(ErrorCode.DOC_ACCESS_DENIED)
      }
    }

    const restored = await repo.restoreDocVersion(docId!, versionId!, userId)
    if (!restored) throw new AppError(ErrorCode.DOC_VERSION_NOT_FOUND)

    // Bust cache
    await tier3Del('doc:' + docId!)

    res.json({ data: restored })
  })
}
