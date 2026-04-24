import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { 
  AppError, 
  createServiceClient, 
  publish, 
  logger,
  tier3Get,
  tier3Set,
  tier3Del
} from '@clickup/sdk'
import { 
  ErrorCode, 
  DOC_EVENTS,
  DocCreatedEvent,
  DocUpdatedEvent
} from '@clickup/contracts'
import { DocsRepository } from './docs.repository.js'

export class DocsService {
  private identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  constructor(private readonly repository: DocsRepository) {}

  private getIdentityClient(traceId?: string) {
    const options: { traceId?: string } = {}
    if (traceId) options.traceId = traceId
    return createServiceClient(this.identityUrl, options) as any
  }

  private async verifyMembership(workspaceId: string, userId: string, traceId?: string) {
    const client = this.getIdentityClient(traceId)
    try {
      const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId)
      const member = response.data?.data || response.data
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      return member
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }
  }

  async createDoc(userId: string, input: { title?: string, workspaceId: string, parentId?: string }, traceId?: string) {
    await this.verifyMembership(input.workspaceId, userId, traceId)

    let parentPath = '/' + input.workspaceId + '/'
    if (input.parentId) {
      const parent = await this.repository.getDoc(input.parentId)
      if (!parent || parent.workspace_id !== input.workspaceId) {
        throw new AppError(ErrorCode.DOC_NOT_FOUND)
      }
      parentPath = parent.path
    }

    const docId = randomUUID()
    const path = parentPath + docId + '/'

    const doc = await this.repository.createDoc({
      id: docId,
      workspaceId: input.workspaceId,
      title: input.title || 'Untitled',
      parentId: input.parentId || null,
      path,
      createdBy: userId
    })

    await publish(DOC_EVENTS.CREATED as any, {
      docId: doc.id,
      workspaceId: doc.workspace_id,
      title: doc.title,
      createdBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    return doc
  }

  async getDoc(userId: string, docId: string, traceId?: string) {
    const cacheKey = 'doc:' + docId
    const cached = await tier3Get(cacheKey)
    if (cached) {
      const doc = cached as any
      await this.verifyMembership(doc.workspace_id, userId, traceId)
      return doc
    }

    const doc = await this.repository.getDoc(docId)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    await this.verifyMembership(doc.workspace_id, userId, traceId)
    await tier3Set(cacheKey, doc)
    return doc
  }

  async updateDocMeta(userId: string, docId: string, input: { title?: string; isPublic?: boolean; content?: Record<string, unknown> }, traceId?: string) {
    const doc = await this.repository.getDoc(docId)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    await this.verifyMembership(doc.workspace_id, userId, traceId)

    // If content is being updated, snapshot current state before saving
    if (input.content !== undefined && doc.content) {
      await this.repository.createDocVersion(docId, doc.content, userId)
    }

    let updated: any
    if (input.content !== undefined) {
      // Update content separately
      const { content, ...metaInput } = input
      updated = await this.repository.updateDocContent(docId, content)
      if (metaInput.title !== undefined || metaInput.isPublic !== undefined) {
        updated = await this.repository.updateDocMeta(docId, metaInput)
      }
    } else {
      updated = await this.repository.updateDocMeta(docId, input)
    }

    await tier3Del('doc:' + docId)

    await publish(DOC_EVENTS.UPDATED as any, {
      docId: updated.id,
      workspaceId: updated.workspace_id,
      updatedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)

    return updated
  }

  async deleteDoc(userId: string, docId: string, traceId?: string) {
    const doc = await this.repository.getDoc(docId)
    if (!doc) throw new AppError(ErrorCode.DOC_NOT_FOUND)

    const member = await this.verifyMembership(doc.workspace_id, userId, traceId)
    const isOwner = doc.created_by === userId || ['owner', 'admin'].includes(member.role || member.data?.role)
    if (!isOwner) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

    await this.repository.softDeleteWithPath(doc.path)
    await tier3Del('doc:' + docId)

    await publish(DOC_EVENTS.DELETED as any, {
      docId: doc.id,
      workspaceId: doc.workspace_id,
      deletedBy: userId,
      occurredAt: new Date().toISOString(),
    } as any)
  }
}

export const createDocsService = (db: Pool) => new DocsService(new DocsRepository(db))
