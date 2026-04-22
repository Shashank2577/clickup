import { Pool, PoolClient } from 'pg'
import { Task, TaskWithRelations } from '@clickup/contracts'
import { TASKS_QUERIES } from './tasks.queries.js'

export class TasksRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<TaskWithRelations | null> {
    const result = await this.db.query(TASKS_QUERIES.FIND_BY_ID, [id])
    if (!result.rows[0]) return null
    return this.mapRowToTask(result.rows[0]) as TaskWithRelations
  }

  async listByList(listId: string, limit: number, offset: number): Promise<Task[]> {
    const result = await this.db.query(TASKS_QUERIES.LIST_BY_LIST, [listId, limit, offset])
    return result.rows.map(r => this.mapRowToTask(r))
  }

  async create(input: any, tx?: PoolClient): Promise<Task> {
    const client = tx ?? this.db
    const result = await client.query(TASKS_QUERIES.INSERT, [
      input.id, input.listId, input.parentId, input.path, input.title, input.description,
      input.status, input.priority, input.assigneeId, input.dueDate, input.position, input.createdBy
    ])
    return this.mapRowToTask(result.rows[0])
  }

  async update(id: string, input: any): Promise<Task | null> {
    const result = await this.db.query(TASKS_QUERIES.UPDATE, [
      input.title, input.description, input.status, input.priority,
      input.assigneeId, input.dueDate, input.position, id
    ])
    if (!result.rows[0]) return null
    return this.mapRowToTask(result.rows[0])
  }

  async softDelete(id: string, path: string): Promise<string[]> {
    const result = await this.db.query(TASKS_QUERIES.SOFT_DELETE, [id, path])
    return result.rows.map((r: any) => r.id as string)
  }

  async getMaxPosition(listId: string, parentId: string | null): Promise<number> {
    const query = TASKS_QUERIES.GET_MAX_POSITION.replace('IS $2', parentId ? '= $2' : 'IS NULL')
    const params = parentId ? [listId, parentId] : [listId]
    const result = await this.db.query(query, params)
    return Number(result.rows[0]?.max_pos ?? 0)
  }

  private mapRowToTask(row: any): Task {
    return {
      ...row,
      listId: row.list_id,
      parentId: row.parent_id,
      assigneeId: row.assignee_id,
      dueDate: row.due_date,
      startDate: row.start_date,
      estimatedMinutes: row.estimated_minutes,
      sprintPoints: row.sprint_points,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    }
  }
}
