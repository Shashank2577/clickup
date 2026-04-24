import { Pool } from 'pg'
import { randomUUID } from 'crypto'

export class DocsRepository {
  constructor(private readonly db: Pool) {}

  async createDoc(record: {
    id: string
    workspaceId: string
    title: string
    parentId: string | null
    path: string
    createdBy: string
  }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO docs (id, workspace_id, title, content, parent_id, path, is_public, created_by) ' +
      'VALUES ($1, $2, $3, \'{}\', $4, $5, FALSE, $6) RETURNING *',
      [record.id, record.workspaceId, record.title, record.parentId, record.path, record.createdBy]
    )
    return rows[0]
  }

  async getDoc(id: string): Promise<any | null> {
    const query = 'SELECT d.*, u.id AS creator_user_id, u.name AS creator_name, u.avatar_url AS creator_avatar ' +
      'FROM docs d JOIN users u ON u.id = d.created_by ' +
      'WHERE d.id = $1 AND d.deleted_at IS NULL'
    const { rows } = await this.db.query(query, [id])
    return rows[0] || null
  }

  async updateDocMeta(id: string, input: { title?: string; isPublic?: boolean }): Promise<any> {
    const { rows } = await this.db.query(
      'UPDATE docs SET title = COALESCE($2, title), is_public = COALESCE($3, is_public), updated_at = NOW() ' +
      'WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id, input.title ?? null, input.isPublic ?? null]
    )
    return rows[0]
  }

  async softDeleteWithPath(path: string): Promise<void> {
    await this.db.query(
      'UPDATE docs SET deleted_at = NOW() WHERE path LIKE $1 || \'%\' AND deleted_at IS NULL',
      [path]
    )
  }

  async getLatestSnapshot(docId: string): Promise<{ stateVector: Buffer; updateData: Buffer } | null> {
    const { rows } = await this.db.query(
      'SELECT state_vector, update_data FROM doc_snapshots WHERE doc_id = $1 ORDER BY created_at DESC LIMIT 1',
      [docId]
    )
    if (!rows[0]) return null
    return {
      stateVector: rows[0].state_vector,
      updateData: rows[0].update_data,
    }
  }

  async saveSnapshot(docId: string, stateVector: Uint8Array, updateData: Uint8Array): Promise<void> {
    await this.db.query(
      'INSERT INTO doc_snapshots (doc_id, state_vector, update_data) VALUES ($1, $2, $3)',
      [docId, Buffer.from(stateVector), Buffer.from(updateData)]
    )
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    )
    return (rowCount ?? 0) > 0
  }

  // ============================================================
  // Doc Content Update (stores content in JSONB column)
  // ============================================================

  async updateDocContent(id: string, content: Record<string, unknown>): Promise<any> {
    const { rows } = await this.db.query(
      'UPDATE docs SET content = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id, JSON.stringify(content)]
    )
    return rows[0]
  }

  // ============================================================
  // Doc Permissions
  // ============================================================

  async listDocPermissions(docId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT dp.id, dp.doc_id AS "docId", dp.user_id AS "userId", dp.role,
              dp.created_at AS "createdAt",
              u.name AS "userName", u.email AS "userEmail", u.avatar_url AS "userAvatarUrl"
       FROM doc_permissions dp
       LEFT JOIN users u ON u.id = dp.user_id
       WHERE dp.doc_id = $1
       ORDER BY dp.created_at ASC`,
      [docId]
    )
    return rows
  }

  async getDocPermissionForUser(docId: string, userId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT id, doc_id AS "docId", user_id AS "userId", role, created_at AS "createdAt"
       FROM doc_permissions
       WHERE doc_id = $1 AND user_id = $2`,
      [docId, userId]
    )
    return rows[0] ?? null
  }

  async grantDocPermission(docId: string, userId: string, role: 'viewer' | 'commenter' | 'editor'): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO doc_permissions (doc_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (doc_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, doc_id AS "docId", user_id AS "userId", role, created_at AS "createdAt"`,
      [docId, userId, role]
    )
    return rows[0]
  }

  async revokeDocPermission(docId: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM doc_permissions WHERE doc_id = $1 AND user_id = $2',
      [docId, userId]
    )
    return (rowCount ?? 0) > 0
  }

  // ============================================================
  // Doc Share Links
  // ============================================================

  async getShareLink(docId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT id, doc_id AS "docId", token, role,
              expires_at AS "expiresAt", created_at AS "createdAt"
       FROM doc_share_links
       WHERE doc_id = $1`,
      [docId]
    )
    return rows[0] ?? null
  }

  async getShareLinkByToken(token: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT sl.id, sl.doc_id AS "docId", sl.token, sl.role,
              sl.expires_at AS "expiresAt", sl.created_at AS "createdAt"
       FROM doc_share_links sl
       WHERE sl.token = $1`,
      [token]
    )
    return rows[0] ?? null
  }

  async upsertShareLink(docId: string, role: 'viewer' | 'commenter', expiresAt?: string): Promise<any> {
    const token = randomUUID()
    const { rows } = await this.db.query(
      `INSERT INTO doc_share_links (doc_id, token, role, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (doc_id) DO UPDATE
         SET token = EXCLUDED.token, role = EXCLUDED.role, expires_at = EXCLUDED.expires_at
       RETURNING id, doc_id AS "docId", token, role, expires_at AS "expiresAt", created_at AS "createdAt"`,
      [docId, token, role, expiresAt ?? null]
    )
    return rows[0]
  }

  async deleteShareLink(docId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM doc_share_links WHERE doc_id = $1',
      [docId]
    )
    return (rowCount ?? 0) > 0
  }

  // ============================================================
  // Doc Version History
  // ============================================================

  async createDocVersion(docId: string, content: Record<string, unknown>, createdBy: string): Promise<any> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Insert new version
      const { rows } = await client.query(
        `INSERT INTO doc_versions (doc_id, content, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, doc_id AS "docId", created_by AS "createdBy", created_at AS "createdAt",
                   length(content::text) AS "sizeBytes"`,
        [docId, JSON.stringify(content), createdBy]
      )

      // Prune oldest versions beyond 50 per doc
      await client.query(
        `DELETE FROM doc_versions
         WHERE doc_id = $1
           AND id NOT IN (
             SELECT id FROM doc_versions
             WHERE doc_id = $1
             ORDER BY created_at DESC
             LIMIT 50
           )`,
        [docId]
      )

      await client.query('COMMIT')
      return rows[0]
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async listDocVersions(docId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT v.id, v.doc_id AS "docId", v.created_by AS "createdBy",
              v.created_at AS "createdAt",
              length(v.content::text) AS "sizeBytes",
              u.name AS "creatorName"
       FROM doc_versions v
       LEFT JOIN users u ON u.id = v.created_by
       WHERE v.doc_id = $1
       ORDER BY v.created_at DESC`,
      [docId]
    )
    return rows
  }

  async getDocVersion(docId: string, versionId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT v.id, v.doc_id AS "docId", v.content,
              v.created_by AS "createdBy", v.created_at AS "createdAt",
              u.name AS "creatorName"
       FROM doc_versions v
       LEFT JOIN users u ON u.id = v.created_by
       WHERE v.doc_id = $1 AND v.id = $2`,
      [docId, versionId]
    )
    return rows[0] ?? null
  }

  async restoreDocVersion(docId: string, versionId: string, restoredBy: string): Promise<any | null> {
    const version = await this.getDocVersion(docId, versionId)
    if (!version) return null

    // Snapshot current content before restoring
    const current = await this.getDoc(docId)
    if (current) {
      await this.createDocVersion(docId, current.content ?? {}, restoredBy)
    }

    // Restore
    const { rows } = await this.db.query(
      'UPDATE docs SET content = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [docId, JSON.stringify(version.content)]
    )
    return rows[0] ?? null
  }
}

export const createDocsRepository = (db: Pool) => new DocsRepository(db)
