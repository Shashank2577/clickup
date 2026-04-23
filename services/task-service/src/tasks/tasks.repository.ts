import { Pool } from 'pg'
import { Task, TaskPriority, TaskRelationType } from '@clickup/contracts'

export class TasksRepository {
  constructor(private readonly db: Pool) {}

  async getTask(id: string): Promise<any | null> {
    const query = 'SELECT t.*, u.id AS assignee_user_id, u.name AS assignee_name, u.avatar_url AS assignee_avatar, ' +
      'COUNT(DISTINCT s.id) AS subtask_count, COUNT(DISTINCT c.id) AS comment_count ' +
      'FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL ' +
      'LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL ' +
      'WHERE t.id = $1 AND t.deleted_at IS NULL GROUP BY t.id, u.id, u.name, u.avatar_url'
    const { rows } = await this.db.query(query, [id])
    return rows[0] || null
  }

  async getListMetadata(listId: string): Promise<any | null> {
    const query = 'SELECT l.id as list_id, s.id as space_id, s.workspace_id FROM lists l JOIN spaces s ON s.id = l.space_id WHERE l.id = $1'
    const { rows } = await this.db.query(query, [listId])
    return rows[0] || null
  }

  async createTask(record: {
    id: string
    listId: string
    title: string
    parentId: string | null
    path: string
    createdBy: string
    priority?: TaskPriority
    assigneeId?: string
  }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO tasks (id, list_id, path, title, priority, assignee_id, parent_id, created_by, version) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0) RETURNING *',
      [record.id, record.listId, record.path, record.title, record.priority || 'none', record.assigneeId || null, record.parentId, record.createdBy]
    )
    return rows[0]
  }

  async listTasks(listId: string, limit: number, offset: number): Promise<any[]> {
    const query = 'SELECT t.*, u.id AS assignee_user_id, u.name AS assignee_name, u.avatar_url AS assignee_avatar, ' +
      'COUNT(DISTINCT s.id) AS subtask_count, COUNT(DISTINCT c.id) AS comment_count ' +
      'FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL ' +
      'LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL ' +
      'WHERE t.list_id = $1 AND t.parent_id IS NULL AND t.deleted_at IS NULL ' +
      'GROUP BY t.id, u.id, u.name, u.avatar_url ORDER BY t.position ASC LIMIT $2 OFFSET $3'
    const { rows } = await this.db.query(query, [listId, limit, offset])
    return rows
  }

  async countTasks(listId: string): Promise<number> {
    const { rows } = await this.db.query('SELECT COUNT(*) FROM tasks WHERE list_id = $1 AND parent_id IS NULL AND deleted_at IS NULL', [listId])
    return parseInt(rows[0].count, 10)
  }

  async updateTask(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates)
    if (fields.length === 0) return this.getTask(id)

    const setClause = fields.map((f, i) => f + ' = $' + (i + 2)).join(', ')
    const values = fields.map(f => updates[f])
    const query = 'UPDATE tasks SET ' + setClause + ', updated_at = NOW(), version = version + 1 WHERE id = $1 AND deleted_at IS NULL RETURNING *'
    
    const { rows } = await this.db.query(query, [id, ...values])
    return rows[0]
  }

  async softDeleteWithPath(path: string): Promise<void> {
    await this.db.query('UPDATE tasks SET deleted_at = NOW() WHERE path LIKE $1 || \'%\' AND deleted_at IS NULL', [path])
  }

  async moveTask(id: string, newBasePath: string, oldPath: string): Promise<void> {
    await this.db.query(
      'UPDATE tasks SET path = $1 || substring(path FROM length($2) + 1) WHERE path LIKE $2 || \'%\' AND deleted_at IS NULL',
      [newBasePath, oldPath]
    )
  }

  async addTag(taskId: string, tag: string): Promise<void> {
    await this.db.query('INSERT INTO task_tags (task_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [taskId, tag])
  }

  async removeTag(taskId: string, tag: string): Promise<void> {
    await this.db.query('DELETE FROM task_tags WHERE task_id = $1 AND tag = $2', [taskId, tag])
  }

  async getTags(taskId: string): Promise<string[]> {
    const { rows } = await this.db.query('SELECT tag FROM task_tags WHERE task_id = $1', [taskId])
    return rows.map(r => r.tag)
  }

  // ── Relations ───────────────────────────────────────────────────────────────

  async getRelations(taskId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT tr.*, t.title AS related_title, t.status AS related_status, t.priority AS related_priority
       FROM task_relations tr
       JOIN tasks t ON t.id = tr.related_task_id
       WHERE tr.task_id = $1`,
      [taskId],
    )
    return rows
  }

  async addRelation(record: { taskId: string; relatedTaskId: string; type: string; createdBy: string }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO task_relations (task_id, related_task_id, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [record.taskId, record.relatedTaskId, record.type, record.createdBy],
    )
    return rows[0]
  }

  async deleteRelation(relationId: string, taskId: string): Promise<void> {
    await this.db.query('DELETE FROM task_relations WHERE id = $1 AND task_id = $2', [relationId, taskId])
  }

  // ── Watchers ────────────────────────────────────────────────────────────────

  async getWatchers(taskId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT tw.user_id, tw.created_at, u.name, u.avatar_url FROM task_watchers tw JOIN users u ON u.id = tw.user_id WHERE tw.task_id = $1',
      [taskId],
    )
    return rows
  }

  async addWatcher(taskId: string, userId: string): Promise<void> {
    await this.db.query(
      'INSERT INTO task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, userId],
    )
  }

  async removeWatcher(taskId: string, userId: string): Promise<void> {
    await this.db.query('DELETE FROM task_watchers WHERE task_id = $1 AND user_id = $2', [taskId, userId])
  }

  // ── Checklists ──────────────────────────────────────────────────────────────

  async getChecklists(taskId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT c.*, COALESCE(
         json_agg(ci ORDER BY ci.position ASC) FILTER (WHERE ci.id IS NOT NULL), '[]'
       ) AS items
       FROM checklists c
       LEFT JOIN checklist_items ci ON ci.checklist_id = c.id
       WHERE c.task_id = $1
       GROUP BY c.id ORDER BY c.position ASC`,
      [taskId],
    )
    return rows
  }

  async getChecklist(checklistId: string): Promise<any | null> {
    const { rows } = await this.db.query('SELECT * FROM checklists WHERE id = $1', [checklistId])
    return rows[0] || null
  }

  async createChecklist(taskId: string, title: string): Promise<any> {
    const { rows: pos } = await this.db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklists WHERE task_id = $1',
      [taskId],
    )
    const position = pos[0].next
    const { rows } = await this.db.query(
      'INSERT INTO checklists (task_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [taskId, title, position],
    )
    return rows[0]
  }

  async deleteChecklist(checklistId: string): Promise<void> {
    await this.db.query('DELETE FROM checklists WHERE id = $1', [checklistId])
  }

  async getChecklistItem(itemId: string): Promise<any | null> {
    const { rows } = await this.db.query('SELECT * FROM checklist_items WHERE id = $1', [itemId])
    return rows[0] || null
  }

  async createChecklistItem(checklistId: string, input: { title: string; assigneeId?: string; dueDate?: string }): Promise<any> {
    const { rows: pos } = await this.db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklist_items WHERE checklist_id = $1',
      [checklistId],
    )
    const position = pos[0].next
    const { rows } = await this.db.query(
      'INSERT INTO checklist_items (checklist_id, title, assignee_id, due_date, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [checklistId, input.title, input.assigneeId || null, input.dueDate || null, position],
    )
    return rows[0]
  }

  async updateChecklistItem(itemId: string, input: Record<string, unknown>): Promise<any> {
    const map: Record<string, string> = { title: 'title', completed: 'completed', assigneeId: 'assignee_id', dueDate: 'due_date' }
    const updates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && map[k]) updates[map[k]] = v
    }
    const fields = Object.keys(updates)
    if (fields.length === 0) return this.getChecklistItem(itemId)
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows } = await this.db.query(
      `UPDATE checklist_items SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [itemId, ...Object.values(updates)],
    )
    return rows[0]
  }

  async deleteChecklistItem(itemId: string): Promise<void> {
    await this.db.query('DELETE FROM checklist_items WHERE id = $1', [itemId])
  }

  // ── Time Entries ────────────────────────────────────────────────────────────

  async getTimeEntries(taskId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM time_entries WHERE task_id = $1 ORDER BY started_at DESC',
      [taskId],
    )
    return rows
  }

  async getTimeEntry(entryId: string): Promise<any | null> {
    const { rows } = await this.db.query('SELECT * FROM time_entries WHERE id = $1', [entryId])
    return rows[0] || null
  }

  async createTimeEntry(record: {
    taskId: string; userId: string; minutes: number
    billable: boolean; note?: string; startedAt: Date; endedAt: Date
  }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO time_entries (task_id, user_id, minutes, billable, note, started_at, ended_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [record.taskId, record.userId, record.minutes, record.billable, record.note || null, record.startedAt, record.endedAt],
    )
    return rows[0]
  }

  async updateTimeEntry(entryId: string, updates: Record<string, unknown>): Promise<any> {
    const fields = Object.keys(updates)
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows } = await this.db.query(
      `UPDATE time_entries SET ${setClause} WHERE id = $1 RETURNING *`,
      [entryId, ...Object.values(updates)],
    )
    return rows[0]
  }

  async deleteTimeEntry(entryId: string): Promise<void> {
    await this.db.query('DELETE FROM time_entries WHERE id = $1', [entryId])
  }

  // ── Bulk Operations ─────────────────────────────────────────────────────────

  async bulkUpdateTasks(taskIds: string[], updates: Record<string, unknown>): Promise<any[]> {
    const map: Record<string, string> = {
      status: 'status', priority: 'priority', assigneeId: 'assignee_id', dueDate: 'due_date',
    }
    const dbUpdates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined && map[k]) dbUpdates[map[k]] = v
    }
    const fields = Object.keys(dbUpdates)
    if (fields.length === 0) return []
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const idPlaceholders = taskIds.map((_, i) => `$${fields.length + i + 1}`).join(', ')
    const { rows } = await this.db.query(
      `UPDATE tasks SET ${setClause}, updated_at = NOW(), version = version + 1
       WHERE id IN (${idPlaceholders}) AND deleted_at IS NULL RETURNING *`,
      [...Object.values(dbUpdates), ...taskIds],
    )
    return rows
  }

  // ── Custom Fields ───────────────────────────────────────────────────────────

  async getCustomFields(workspaceId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM custom_fields WHERE workspace_id = $1 ORDER BY created_at ASC',
      [workspaceId],
    )
    return rows
  }

  async createCustomField(record: { workspaceId: string; name: string; type: string; config: Record<string, unknown> }): Promise<any> {
    const { rows } = await this.db.query(
      'INSERT INTO custom_fields (workspace_id, name, type, config) VALUES ($1, $2, $3, $4) RETURNING *',
      [record.workspaceId, record.name, record.type, JSON.stringify(record.config)],
    )
    return rows[0]
  }

  async getTaskCustomFields(taskId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT cf.*, tcf.value, tcf.updated_at AS value_updated_at
       FROM task_custom_fields tcf JOIN custom_fields cf ON cf.id = tcf.field_id
       WHERE tcf.task_id = $1`,
      [taskId],
    )
    return rows
  }

  async setTaskCustomFieldValue(taskId: string, fieldId: string, value: unknown): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO task_custom_fields (task_id, field_id, value) VALUES ($1, $2, $3)
       ON CONFLICT (task_id, field_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING *`,
      [taskId, fieldId, JSON.stringify(value)],
    )
    return rows[0]
  }
}

export const createTasksRepository = (db: Pool) => new TasksRepository(db)
