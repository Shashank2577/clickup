import express from 'express'
import request from 'supertest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withRollback, getTestDb, testAuth } from '@clickup/test-helpers'
import { errorHandler, correlationId } from '@clickup/sdk'
import { createRoutes } from '../../src/routes.js'

// ============================================================
// Test setup
// ============================================================

process.env['JWT_SECRET'] = 'test-secret-for-docs-tests'

// Mock NATS publish — prevent real connections in tests
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

import { publish } from '@clickup/sdk'
const mockedPublish = vi.mocked(publish)

function buildApp() {
  const db = getTestDb()
  const app = express()
  app.use(express.json())
  app.use(correlationId)
  app.use(createRoutes(db))
  app.use(errorHandler)
  return app
}

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'
const USER_ID = '00000000-0000-4000-8000-000000000002'

const auth = testAuth({ userId: USER_ID, workspaceId: WORKSPACE_ID })

// ============================================================
// Tests
// ============================================================

describe('Docs Handler Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/v1/workspaces/:workspaceId/docs', () => {
    it('returns 401 without auth token', async () => {
      const app = buildApp()
      const res = await request(app)
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
        .send({ title: 'Test' })

      expect(res.status).toBe(401)
    })

    it('creates a doc with correct path (201)', async () => {
      await withRollback(async () => {
        const app = buildApp()
        const res = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'My Document' })

        expect(res.status).toBe(201)
        expect(res.body.data.title).toBe('My Document')
        expect(res.body.data.workspaceId).toBe(WORKSPACE_ID)
        expect(res.body.data.parentId).toBeNull()

        // Path should be /{workspaceId}/{docId}/
        const docId = res.body.data.id
        expect(res.body.data.path).toBe(`/${WORKSPACE_ID}/${docId}/`)

        // Event should have been published
        expect(mockedPublish).toHaveBeenCalledWith(
          'doc.created',
          expect.objectContaining({
            docId,
            workspaceId: WORKSPACE_ID,
            title: 'My Document',
          }),
        )
      })
    })

    it('creates a nested page with inherited path (201)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        // Create parent doc
        const parentRes = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Parent' })

        expect(parentRes.status).toBe(201)
        const parentId = parentRes.body.data.id
        const parentPath = parentRes.body.data.path

        // Create child page via the pages endpoint
        const childRes = await request(app)
          .post(`/api/v1/docs/${parentId}/pages`)
          .set(auth.headers)
          .send({ title: 'Child Page' })

        expect(childRes.status).toBe(201)
        expect(childRes.body.data.parentId).toBe(parentId)

        // Child path should be {parentPath}{childId}/
        const childId = childRes.body.data.id
        expect(childRes.body.data.path).toBe(`${parentPath}${childId}/`)
      })
    })

    it('returns 422 on invalid input', async () => {
      const app = buildApp()
      const res = await request(app)
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
        .set(auth.headers)
        .send({ parent_id: 'not-a-uuid' })

      expect(res.status).toBe(422)
    })
  })

  describe('GET /api/v1/docs/:docId', () => {
    it('returns doc with children (200)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        // Create a doc
        const createRes = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Fetchable Doc' })

        const docId = createRes.body.data.id

        // Create a child page
        await request(app)
          .post(`/api/v1/docs/${docId}/pages`)
          .set(auth.headers)
          .send({ title: 'Child Page' })

        // Get doc
        const getRes = await request(app)
          .get(`/api/v1/docs/${docId}`)
          .set(auth.headers)

        expect(getRes.status).toBe(200)
        expect(getRes.body.data.doc.id).toBe(docId)
        expect(getRes.body.data.children).toHaveLength(1)
        expect(getRes.body.data.children[0].title).toBe('Child Page')
      })
    })

    it('returns 404 for nonexistent doc', async () => {
      const app = buildApp()
      const res = await request(app)
        .get('/api/v1/docs/00000000-0000-4000-8000-000000000099')
        .set(auth.headers)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('DOC_NOT_FOUND')
    })
  })

  describe('PATCH /api/v1/docs/:docId', () => {
    it('updates a doc (200)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        const createRes = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Original' })

        const docId = createRes.body.data.id

        const patchRes = await request(app)
          .patch(`/api/v1/docs/${docId}`)
          .set(auth.headers)
          .send({ title: 'Updated' })

        expect(patchRes.status).toBe(200)
        expect(patchRes.body.data.title).toBe('Updated')
      })
    })
  })

  describe('DELETE /api/v1/docs/:docId', () => {
    it('soft-deletes with cascade (204)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        // Create parent
        const parentRes = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Parent' })

        const parentId = parentRes.body.data.id

        // Create child
        const childRes = await request(app)
          .post(`/api/v1/docs/${parentId}/pages`)
          .set(auth.headers)
          .send({ title: 'Child' })

        const childId = childRes.body.data.id

        // Delete parent
        const deleteRes = await request(app)
          .delete(`/api/v1/docs/${parentId}`)
          .set(auth.headers)

        expect(deleteRes.status).toBe(204)

        // Verify parent is gone
        const getParent = await request(app)
          .get(`/api/v1/docs/${parentId}`)
          .set(auth.headers)

        expect(getParent.status).toBe(404)

        // Verify child is also gone
        const getChild = await request(app)
          .get(`/api/v1/docs/${childId}`)
          .set(auth.headers)

        expect(getChild.status).toBe(404)
      })
    })

    it('returns 404 on already-deleted doc', async () => {
      const app = buildApp()
      const res = await request(app)
        .delete('/api/v1/docs/00000000-0000-4000-8000-000000000099')
        .set(auth.headers)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/v1/workspaces/:workspaceId/docs', () => {
    it('lists top-level docs (200)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Doc A' })

        await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Doc B' })

        const listRes = await request(app)
          .get(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)

        expect(listRes.status).toBe(200)
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('GET /api/v1/docs/:docId/pages', () => {
    it('lists child pages (200)', async () => {
      await withRollback(async () => {
        const app = buildApp()

        const parentRes = await request(app)
          .post(`/api/v1/workspaces/${WORKSPACE_ID}/docs`)
          .set(auth.headers)
          .send({ title: 'Parent' })

        const parentId = parentRes.body.data.id

        await request(app)
          .post(`/api/v1/docs/${parentId}/pages`)
          .set(auth.headers)
          .send({ title: 'Page 1' })

        await request(app)
          .post(`/api/v1/docs/${parentId}/pages`)
          .set(auth.headers)
          .send({ title: 'Page 2' })

        const pagesRes = await request(app)
          .get(`/api/v1/docs/${parentId}/pages`)
          .set(auth.headers)

        expect(pagesRes.status).toBe(200)
        expect(pagesRes.body.data).toHaveLength(2)
      })
    })
  })
})
