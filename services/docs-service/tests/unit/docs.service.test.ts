import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@clickup/contracts'
import { AppError } from '@clickup/sdk'
import { DocsService } from '../../src/docs/docs.service.js'
import type { DocsRepository, DocWithChildCount } from '../../src/docs/docs.repository.js'
import type { Doc } from '@clickup/contracts'

// ============================================================
// Mock dependencies
// ============================================================

// Mock NATS publish
vi.mock('@clickup/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clickup/sdk')>()
  return {
    ...actual,
    publish: vi.fn().mockResolvedValue(undefined),
    createServiceClient: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    }),
    tier2Get: vi.fn().mockResolvedValue(null),
    tier2Set: vi.fn().mockResolvedValue(undefined),
    tier2Del: vi.fn().mockResolvedValue(undefined),
  }
})

// Import mocked versions
import { publish, createServiceClient, tier2Get, tier2Set, tier2Del } from '@clickup/sdk'

const mockedPublish = vi.mocked(publish)
const mockedCreateServiceClient = vi.mocked(createServiceClient)
const mockedTier2Get = vi.mocked(tier2Get)
const mockedTier2Del = vi.mocked(tier2Del)

// ============================================================
// Helper: create a mock repository
// ============================================================

function createMockRepo(): DocsRepository {
  return {
    findById: vi.fn(),
    listTopLevel: vi.fn(),
    listChildren: vi.fn(),
    listDescendants: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDeleteWithDescendants: vi.fn(),
  } as unknown as DocsRepository
}

// ============================================================
// Helper: build a fake Doc
// ============================================================

function fakeDoc(overrides: Partial<Doc> = {}): Doc {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    title: 'Test Doc',
    content: {},
    parentId: null,
    path: '/ws-1/doc-1/',
    isPublic: false,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ============================================================
// Tests
// ============================================================

describe('DocsService', () => {
  let repo: DocsRepository
  let service: DocsService

  beforeEach(() => {
    vi.clearAllMocks()
    repo = createMockRepo()
    service = new DocsService(repo)

    // Default: identity service allows access
    mockedCreateServiceClient.mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    } as any)
  })

  describe('createDoc', () => {
    it('computes root path as /{workspaceId}/{docId}/', async () => {
      const createdDoc = fakeDoc({ id: 'new-doc-id' })
      vi.mocked(repo.create).mockResolvedValue(createdDoc)

      const result = await service.createDoc({
        workspaceId: 'ws-1',
        title: 'My Doc',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result).toEqual(createdDoc)

      // Verify the create call had the correct path pattern
      const createCall = vi.mocked(repo.create).mock.calls[0]![0]
      expect(createCall.path).toMatch(/^\/ws-1\/[a-f0-9-]+\/$/)
      expect(createCall.parentId).toBeNull()
      expect(createCall.title).toBe('My Doc')
    })

    it('computes nested path as {parentPath}{docId}/', async () => {
      const parent = fakeDoc({ id: 'parent-1', path: '/ws-1/parent-1/' })
      vi.mocked(repo.findById).mockResolvedValue(parent)

      const child = fakeDoc({ id: 'child-1', parentId: 'parent-1' })
      vi.mocked(repo.create).mockResolvedValue(child)

      await service.createDoc({
        workspaceId: 'ws-1',
        parentId: 'parent-1',
        userId: 'user-1',
        token: 'tok',
      })

      const createCall = vi.mocked(repo.create).mock.calls[0]![0]
      expect(createCall.path).toMatch(/^\/ws-1\/parent-1\/[a-f0-9-]+\/$/)
      expect(createCall.parentId).toBe('parent-1')
    })

    it('throws DOC_NOT_FOUND when parent does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)

      await expect(
        service.createDoc({
          workspaceId: 'ws-1',
          parentId: 'nonexistent',
          userId: 'user-1',
          token: 'tok',
        }),
      ).rejects.toThrow(AppError)

      try {
        await service.createDoc({
          workspaceId: 'ws-1',
          parentId: 'nonexistent',
          userId: 'user-1',
          token: 'tok',
        })
      } catch (err) {
        expect((err as AppError).code).toBe(ErrorCode.DOC_NOT_FOUND)
      }
    })

    it('publishes DocCreatedEvent after successful insert', async () => {
      const createdDoc = fakeDoc({ id: 'new-doc', title: 'Event Doc' })
      vi.mocked(repo.create).mockResolvedValue(createdDoc)

      await service.createDoc({
        workspaceId: 'ws-1',
        title: 'Event Doc',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedPublish).toHaveBeenCalledTimes(1)
      expect(mockedPublish).toHaveBeenCalledWith(
        'doc.created',
        expect.objectContaining({
          docId: 'new-doc',
          workspaceId: 'ws-1',
          title: 'Event Doc',
          createdBy: 'user-1',
        }),
      )
    })

    it('does not publish event if insert throws', async () => {
      vi.mocked(repo.create).mockRejectedValue(new Error('DB error'))

      await expect(
        service.createDoc({
          workspaceId: 'ws-1',
          userId: 'user-1',
          token: 'tok',
        }),
      ).rejects.toThrow('DB error')

      expect(mockedPublish).not.toHaveBeenCalled()
    })

    it('invalidates docList cache on create', async () => {
      vi.mocked(repo.create).mockResolvedValue(fakeDoc())

      await service.createDoc({
        workspaceId: 'ws-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedTier2Del).toHaveBeenCalledWith('doc:list:ws-1')
    })

    it('defaults title to Untitled when not provided', async () => {
      vi.mocked(repo.create).mockResolvedValue(fakeDoc())

      await service.createDoc({
        workspaceId: 'ws-1',
        userId: 'user-1',
        token: 'tok',
      })

      const createCall = vi.mocked(repo.create).mock.calls[0]![0]
      expect(createCall.title).toBe('Untitled')
    })
  })

  describe('getDoc', () => {
    it('returns doc with children', async () => {
      const doc = fakeDoc()
      vi.mocked(repo.findById).mockResolvedValue(doc)
      vi.mocked(repo.listChildren).mockResolvedValue([])

      const result = await service.getDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result.doc).toEqual(doc)
      expect(result.children).toEqual([])
    })

    it('throws DOC_NOT_FOUND when doc does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)

      await expect(
        service.getDoc({ docId: 'nope', userId: 'user-1', token: 'tok' }),
      ).rejects.toThrow(AppError)
    })

    it('skips membership check for public docs', async () => {
      const publicDoc = fakeDoc({ isPublic: true })
      vi.mocked(repo.findById).mockResolvedValue(publicDoc)
      vi.mocked(repo.listChildren).mockResolvedValue([])

      await service.getDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      // assertWorkspaceMember should NOT have been called
      const client = mockedCreateServiceClient.mock.results[0]
      // If createServiceClient was not called at all, the membership check was skipped
      // (it was called in the constructor test setup, but not in getDoc for public docs)
      // The key assertion: no HTTP call to identity service
      expect(mockedCreateServiceClient).not.toHaveBeenCalled()
    })

    it('checks membership for private docs', async () => {
      const privateDoc = fakeDoc({ isPublic: false })
      vi.mocked(repo.findById).mockResolvedValue(privateDoc)
      vi.mocked(repo.listChildren).mockResolvedValue([])

      await service.getDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedCreateServiceClient).toHaveBeenCalled()
    })
  })

  describe('updateDoc', () => {
    it('updates and returns the doc', async () => {
      const existing = fakeDoc()
      const updated = fakeDoc({ title: 'Updated Title' })
      vi.mocked(repo.findById).mockResolvedValue(existing)
      vi.mocked(repo.update).mockResolvedValue(updated)

      const result = await service.updateDoc({
        docId: 'doc-1',
        title: 'Updated Title',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result.title).toBe('Updated Title')
    })

    it('publishes DocUpdatedEvent', async () => {
      vi.mocked(repo.findById).mockResolvedValue(fakeDoc())
      vi.mocked(repo.update).mockResolvedValue(fakeDoc({ title: 'New' }))

      await service.updateDoc({
        docId: 'doc-1',
        title: 'New',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedPublish).toHaveBeenCalledWith(
        'doc.updated',
        expect.objectContaining({
          docId: 'doc-1',
          title: 'New',
          updatedBy: 'user-1',
        }),
      )
    })

    it('invalidates caches on update', async () => {
      vi.mocked(repo.findById).mockResolvedValue(fakeDoc())
      vi.mocked(repo.update).mockResolvedValue(fakeDoc())

      await service.updateDoc({
        docId: 'doc-1',
        title: 'X',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedTier2Del).toHaveBeenCalledWith('doc:doc-1')
      expect(mockedTier2Del).toHaveBeenCalledWith('doc:list:ws-1')
    })
  })

  describe('deleteDoc', () => {
    it('soft-deletes doc and descendants', async () => {
      const existing = fakeDoc()
      vi.mocked(repo.findById).mockResolvedValue(existing)
      vi.mocked(repo.softDeleteWithDescendants).mockResolvedValue(['doc-1', 'child-1'])

      await service.deleteDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(repo.softDeleteWithDescendants).toHaveBeenCalledWith('doc-1', '/ws-1/doc-1/')
    })

    it('publishes DocDeletedEvent with all deleted IDs', async () => {
      vi.mocked(repo.findById).mockResolvedValue(fakeDoc())
      vi.mocked(repo.softDeleteWithDescendants).mockResolvedValue(['doc-1', 'child-1', 'child-2'])

      await service.deleteDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedPublish).toHaveBeenCalledWith(
        'doc.deleted',
        expect.objectContaining({
          docId: 'doc-1',
          deletedIds: ['doc-1', 'child-1', 'child-2'],
          deletedBy: 'user-1',
        }),
      )
    })

    it('invalidates caches on delete', async () => {
      vi.mocked(repo.findById).mockResolvedValue(fakeDoc())
      vi.mocked(repo.softDeleteWithDescendants).mockResolvedValue(['doc-1'])

      await service.deleteDoc({
        docId: 'doc-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(mockedTier2Del).toHaveBeenCalledWith('doc:doc-1')
      expect(mockedTier2Del).toHaveBeenCalledWith('doc:list:ws-1')
    })
  })

  describe('listDocs', () => {
    it('returns cached result when available', async () => {
      const cached: DocWithChildCount[] = [
        { ...fakeDoc(), childCount: 0 },
      ]
      mockedTier2Get.mockResolvedValue(cached)

      const result = await service.listDocs({
        workspaceId: 'ws-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result).toEqual(cached)
      expect(repo.listTopLevel).not.toHaveBeenCalled()
    })

    it('queries DB and caches on miss', async () => {
      mockedTier2Get.mockResolvedValue(null)
      const docs: DocWithChildCount[] = [{ ...fakeDoc(), childCount: 2 }]
      vi.mocked(repo.listTopLevel).mockResolvedValue(docs)

      const result = await service.listDocs({
        workspaceId: 'ws-1',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result).toEqual(docs)
      expect(vi.mocked(tier2Set)).toHaveBeenCalledWith('doc:list:ws-1', docs)
    })
  })

  describe('createPage', () => {
    it('creates a page nested under parent with correct path', async () => {
      const parent = fakeDoc({ id: 'parent-1', path: '/ws-1/parent-1/' })
      vi.mocked(repo.findById).mockResolvedValue(parent)

      const page = fakeDoc({ id: 'page-1', parentId: 'parent-1', path: '/ws-1/parent-1/page-1/' })
      vi.mocked(repo.create).mockResolvedValue(page)

      const result = await service.createPage({
        parentDocId: 'parent-1',
        title: 'Sub Page',
        userId: 'user-1',
        token: 'tok',
      })

      expect(result.parentId).toBe('parent-1')

      const createCall = vi.mocked(repo.create).mock.calls[0]![0]
      expect(createCall.path).toMatch(/^\/ws-1\/parent-1\/[a-f0-9-]+\/$/)
      expect(createCall.workspaceId).toBe('ws-1')
    })

    it('throws DOC_NOT_FOUND when parent does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)

      await expect(
        service.createPage({
          parentDocId: 'nope',
          userId: 'user-1',
          token: 'tok',
        }),
      ).rejects.toThrow(AppError)
    })
  })

  describe('workspace access', () => {
    it('throws AUTH_WORKSPACE_ACCESS_DENIED when not a member', async () => {
      mockedCreateServiceClient.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('403')),
      } as any)

      await expect(
        service.createDoc({
          workspaceId: 'ws-1',
          userId: 'outsider',
          token: 'tok',
        }),
      ).rejects.toThrow(AppError)

      try {
        await service.createDoc({
          workspaceId: 'ws-1',
          userId: 'outsider',
          token: 'tok',
        })
      } catch (err) {
        expect((err as AppError).code).toBe(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      }
    })
  })
})
