import { Pool } from 'pg'

// ============================================================
// Forms Repository — all DB queries for forms and responses
// ============================================================

export interface Form {
  id: string
  workspaceId: string
  listId: string
  title: string
  description: string | null
  fields: unknown[]
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FormResponse {
  id: string
  formId: string
  taskId: string | null
  data: Record<string, unknown>
  submittedBy: string | null
  submittedAt: string
}

function mapFormRow(r: Record<string, unknown>): Form {
  return {
    id: r['id'] as string,
    workspaceId: r['workspace_id'] as string,
    listId: r['list_id'] as string,
    title: r['title'] as string,
    description: (r['description'] as string) ?? null,
    fields: r['fields'] as unknown[],
    isActive: r['is_active'] as boolean,
    createdBy: r['created_by'] as string,
    createdAt: String(r['created_at']),
    updatedAt: String(r['updated_at']),
  }
}

function mapResponseRow(r: Record<string, unknown>): FormResponse {
  return {
    id: r['id'] as string,
    formId: r['form_id'] as string,
    taskId: (r['task_id'] as string) ?? null,
    data: (r['data'] as Record<string, unknown>) ?? {},
    submittedBy: (r['submitted_by'] as string) ?? null,
    submittedAt: String(r['submitted_at']),
  }
}

export function createFormsRepository(db: Pool) {
  return {
    async createForm(input: {
      workspaceId: string
      listId: string
      title: string
      description?: string
      fields: unknown[]
      createdBy: string
    }): Promise<Form> {
      const { rows } = await db.query(
        `INSERT INTO forms (workspace_id, list_id, title, description, fields, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.workspaceId, input.listId, input.title, input.description ?? null, JSON.stringify(input.fields), input.createdBy],
      )
      return mapFormRow(rows[0])
    },

    async listForms(workspaceId: string): Promise<Form[]> {
      const { rows } = await db.query(
        `SELECT * FROM forms WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
      )
      return rows.map(mapFormRow)
    },

    async getForm(formId: string): Promise<Form | null> {
      const { rows } = await db.query(
        `SELECT * FROM forms WHERE id = $1`,
        [formId],
      )
      return rows[0] ? mapFormRow(rows[0]) : null
    },

    async updateForm(
      formId: string,
      updates: { title?: string; description?: string; fields?: unknown[]; isActive?: boolean },
    ): Promise<Form | null> {
      const { rows } = await db.query(
        `UPDATE forms
         SET title       = COALESCE($2, title),
             description = COALESCE($3, description),
             fields      = COALESCE($4, fields),
             is_active   = COALESCE($5, is_active),
             updated_at  = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          formId,
          updates.title ?? null,
          updates.description ?? null,
          updates.fields ? JSON.stringify(updates.fields) : null,
          updates.isActive ?? null,
        ],
      )
      return rows[0] ? mapFormRow(rows[0]) : null
    },

    async deleteForm(formId: string): Promise<boolean> {
      const { rowCount } = await db.query(
        `DELETE FROM forms WHERE id = $1`,
        [formId],
      )
      return rowCount !== null && rowCount > 0
    },

    async submitResponse(input: {
      formId: string
      taskId: string | null
      data: Record<string, unknown>
      submittedBy?: string
    }): Promise<FormResponse> {
      const { rows } = await db.query(
        `INSERT INTO form_responses (form_id, task_id, data, submitted_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.formId, input.taskId, JSON.stringify(input.data), input.submittedBy ?? null],
      )
      return mapResponseRow(rows[0])
    },

    async listResponses(formId: string, limit: number, offset: number): Promise<{ responses: FormResponse[]; total: number }> {
      const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM form_responses WHERE form_id = $1`,
        [formId],
      )
      const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

      const { rows } = await db.query(
        `SELECT * FROM form_responses WHERE form_id = $1 ORDER BY submitted_at DESC LIMIT $2 OFFSET $3`,
        [formId, limit, offset],
      )
      return { responses: rows.map(mapResponseRow), total }
    },

    // Helper: create a task from form response data
    async createTaskFromResponse(
      listId: string,
      data: Record<string, unknown>,
      fields: Array<{ id: string; taskField?: string; label: string }>,
      createdBy: string,
    ): Promise<string | null> {
      // Extract task fields from form data
      let title = 'Form submission'
      let description: string | null = null
      let priority = 'normal'
      let dueDate: string | null = null

      for (const field of fields) {
        const value = data[field.id]
        if (value === undefined || value === null) continue

        switch (field.taskField) {
          case 'title':
            title = String(value)
            break
          case 'description':
            description = String(value)
            break
          case 'priority':
            priority = String(value)
            break
          case 'due_date':
            dueDate = String(value)
            break
          default:
            // If no mapping, append to description
            if (!description) description = ''
            description += `\n${field.label}: ${String(value)}`
        }
      }

      const { rows } = await db.query(
        `INSERT INTO tasks (list_id, title, description, priority, due_date, created_by, path, status)
         VALUES ($1, $2, $3, $4::task_priority, $5, $6, '/', 'open')
         RETURNING id`,
        [listId, title, description, priority, dueDate, createdBy],
      )
      return rows[0]?.id ?? null
    },

    async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
      const result = await db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
        [workspaceId, userId],
      )
      return (result.rowCount ?? 0) > 0
    },
  }
}

export type FormsRepository = ReturnType<typeof createFormsRepository>
