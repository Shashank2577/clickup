import type { Pool, PoolClient } from 'pg'
import type { Doc } from '@clickup/contracts'
import * as Q from './docs.queries.js'

// ============================================================
// Doc with childCount — returned by list queries
// ============================================================

export interface DocWithChildCount extends Doc {
  childCount: number
}

// ============================================================
// DocsRepository — thin layer over SQL, no business logic
// ============================================================

export class DocsRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string, client?: PoolClient): Promise<Doc | null> {
    const executor = client ?? this.db
    const result = await executor.query<Doc>(Q.FIND_BY_ID, [id])
    return result.rows[0] ?? null
  }

  async listTopLevel(workspaceId: string): Promise<DocWithChildCount[]> {
    const result = await this.db.query<DocWithChildCount>(Q.LIST_TOP_LEVEL, [workspaceId])
    return result.rows
  }

  async listChildren(parentId: string): Promise<DocWithChildCount[]> {
    const result = await this.db.query<DocWithChildCount>(Q.LIST_CHILDREN, [parentId])
    return result.rows
  }

  async listDescendants(path: string, docId: string): Promise<Doc[]> {
    const result = await this.db.query<Doc>(Q.LIST_DESCENDANTS, [path, docId])
    return result.rows
  }

  async create(
    input: {
      id: string
      workspaceId: string
      title: string
      content: Record<string, unknown>
      parentId: string | null
      path: string
      isPublic: boolean
      createdBy: string
    },
    client?: PoolClient,
  ): Promise<Doc> {
    const executor = client ?? this.db
    const result = await executor.query<Doc>(Q.INSERT, [
      input.id,
      input.workspaceId,
      input.title,
      JSON.stringify(input.content),
      input.parentId,
      input.path,
      input.isPublic,
      input.createdBy,
    ])
    if (!result.rows[0]) {
      throw new Error('Failed to insert doc')
    }
    return result.rows[0]
  }

  async update(
    id: string,
    input: {
      title?: string
      content?: Record<string, unknown>
      isPublic?: boolean
    },
  ): Promise<Doc | null> {
    const result = await this.db.query<Doc>(Q.UPDATE, [
      id,
      input.title ?? null,
      input.content !== undefined ? JSON.stringify(input.content) : null,
      input.isPublic ?? null,
    ])
    return result.rows[0] ?? null
  }

  async softDeleteWithDescendants(
    id: string,
    path: string,
  ): Promise<string[]> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Delete the doc itself
      const rootResult = await client.query<{ id: string }>(Q.SOFT_DELETE, [id])

      // Delete descendants by path prefix
      const descResult = await client.query<{ id: string }>(Q.SOFT_DELETE_DESCENDANTS, [path, id])

      await client.query('COMMIT')

      const deletedIds = [
        ...rootResult.rows.map((r) => r.id),
        ...descResult.rows.map((r) => r.id),
      ]
      return deletedIds
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
