import { Pool } from 'pg'

// ============================================================
// Views Repository — all DB queries for views and user state
// snake_case DB columns → camelCase in returned objects
// ============================================================

export function createViewsRepository(db: Pool) {
  return {
    async createView(input: {
      listId?: string | null
      workspaceId: string
      name: string
      type: string
      config: Record<string, unknown>
      createdBy: string
      isPrivate: boolean
      position?: number
    }) {
      const result = await db.query(
        `INSERT INTO views (list_id, workspace_id, name, type, config, created_by, is_private, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0))
         RETURNING
           id,
           list_id       AS "listId",
           workspace_id  AS "workspaceId",
           name,
           type,
           config,
           created_by    AS "createdBy",
           is_private    AS "isPrivate",
           position,
           created_at    AS "createdAt",
           updated_at    AS "updatedAt"`,
        [
          input.listId ?? null,
          input.workspaceId,
          input.name,
          input.type,
          JSON.stringify(input.config),
          input.createdBy,
          input.isPrivate,
          input.position ?? 0,
        ],
      )
      return result.rows[0] ?? null
    },

    async getView(id: string) {
      const result = await db.query(
        `SELECT
           id,
           list_id       AS "listId",
           workspace_id  AS "workspaceId",
           name,
           type,
           config,
           created_by    AS "createdBy",
           is_private    AS "isPrivate",
           position,
           created_at    AS "createdAt",
           updated_at    AS "updatedAt"
         FROM views
         WHERE id = $1`,
        [id],
      )
      return result.rows[0] ?? null
    },

    async listViewsByList(listId: string, userId: string) {
      const result = await db.query(
        `SELECT
           id,
           list_id       AS "listId",
           workspace_id  AS "workspaceId",
           name,
           type,
           config,
           created_by    AS "createdBy",
           is_private    AS "isPrivate",
           position,
           created_at    AS "createdAt",
           updated_at    AS "updatedAt"
         FROM views
         WHERE list_id = $1
           AND (is_private = false OR created_by = $2)
         ORDER BY position ASC, created_at ASC`,
        [listId, userId],
      )
      return result.rows
    },

    async listViewsByWorkspace(workspaceId: string, userId: string) {
      const result = await db.query(
        `SELECT
           id,
           list_id       AS "listId",
           workspace_id  AS "workspaceId",
           name,
           type,
           config,
           created_by    AS "createdBy",
           is_private    AS "isPrivate",
           position,
           created_at    AS "createdAt",
           updated_at    AS "updatedAt"
         FROM views
         WHERE workspace_id = $1
           AND list_id IS NULL
           AND (is_private = false OR created_by = $2)
         ORDER BY position ASC, created_at ASC`,
        [workspaceId, userId],
      )
      return result.rows
    },

    async updateView(
      id: string,
      updates: {
        name?: string
        config?: Record<string, unknown>
        isPrivate?: boolean
      },
    ) {
      const result = await db.query(
        `UPDATE views
         SET name       = COALESCE($2, name),
             config     = COALESCE($3, config),
             is_private = COALESCE($4, is_private),
             updated_at = NOW()
         WHERE id = $1
         RETURNING
           id,
           list_id       AS "listId",
           workspace_id  AS "workspaceId",
           name,
           type,
           config,
           created_by    AS "createdBy",
           is_private    AS "isPrivate",
           position,
           created_at    AS "createdAt",
           updated_at    AS "updatedAt"`,
        [
          id,
          updates.name ?? null,
          updates.config !== undefined ? JSON.stringify(updates.config) : null,
          updates.isPrivate ?? null,
        ],
      )
      return result.rows[0] ?? null
    },

    async deleteView(id: string) {
      await db.query(`DELETE FROM views WHERE id = $1`, [id])
    },

    async getUserState(viewId: string, userId: string) {
      const result = await db.query(
        `SELECT
           view_id          AS "viewId",
           user_id          AS "userId",
           collapsed_groups AS "collapsedGroups",
           hidden_columns   AS "hiddenColumns"
         FROM view_user_state
         WHERE view_id = $1 AND user_id = $2`,
        [viewId, userId],
      )
      return result.rows[0] ?? null
    },

    async upsertUserState(
      viewId: string,
      userId: string,
      state: {
        collapsedGroups?: string[]
        hiddenColumns?: string[]
      },
    ) {
      const result = await db.query(
        `INSERT INTO view_user_state (view_id, user_id, collapsed_groups, hidden_columns)
         VALUES ($1, $2, COALESCE($3, '{}'), COALESCE($4, '{}'))
         ON CONFLICT (view_id, user_id) DO UPDATE
           SET collapsed_groups = COALESCE($3, view_user_state.collapsed_groups),
               hidden_columns   = COALESCE($4, view_user_state.hidden_columns)
         RETURNING
           view_id          AS "viewId",
           user_id          AS "userId",
           collapsed_groups AS "collapsedGroups",
           hidden_columns   AS "hiddenColumns"`,
        [
          viewId,
          userId,
          state.collapsedGroups ?? null,
          state.hiddenColumns ?? null,
        ],
      )
      return result.rows[0]
    },

    async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
      const result = await db.query(
        `SELECT 1 FROM workspace_members
         WHERE workspace_id = $1 AND user_id = $2
         LIMIT 1`,
        [workspaceId, userId],
      )
      return (result.rowCount ?? 0) > 0
    },

    /**
     * Raw parameterized task query used by the query engine.
     * Callers are responsible for building the WHERE clause safely.
     */
    async getViewTasksQuery(
      whereClause: string,
      params: unknown[],
      sortClause: string,
      limit: number,
      offset: number,
    ): Promise<{ tasks: unknown[]; total: number }> {
      const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`,
        params,
      )
      const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

      const dataResult = await db.query(
        `SELECT
           t.id,
           t.list_id           AS "listId",
           t.parent_id         AS "parentId",
           t.title,
           t.description,
           t.status,
           t.priority,
           t.assignee_id       AS "assigneeId",
           t.due_date          AS "dueDate",
           t.start_date        AS "startDate",
           t.estimated_minutes AS "estimatedMinutes",
           t.actual_minutes    AS "actualMinutes",
           t.sprint_points     AS "sprintPoints",
           t.position,
           t.created_by        AS "createdBy",
           t.created_at        AS "createdAt",
           t.updated_at        AS "updatedAt",
           t.completed_at      AS "completedAt"
         FROM tasks t
         ${whereClause}
         ${sortClause}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      )

      return { tasks: dataResult.rows, total }
    },
  }
}

export type ViewsRepository = ReturnType<typeof createViewsRepository>
