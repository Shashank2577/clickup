import { TASKS_QUERIES } from './tasks.queries.js';
export class TasksRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const result = await this.db.query(TASKS_QUERIES.FIND_BY_ID, [id]);
        if (!result.rows[0])
            return null;
        return this.mapRowToTask(result.rows[0]);
    }
    async listByList(listId, limit, offset) {
        const result = await this.db.query(TASKS_QUERIES.LIST_BY_LIST, [listId, limit, offset]);
        return result.rows.map(r => this.mapRowToTask(r));
    }
    async create(input, tx) {
        const client = tx ?? this.db;
        const result = await client.query(TASKS_QUERIES.INSERT, [
            input.id, input.listId, input.parentId, input.path, input.title, input.description,
            input.status, input.priority, input.assigneeId, input.dueDate, input.position, input.createdBy
        ]);
        return this.mapRowToTask(result.rows[0]);
    }
    async update(id, input) {
        const result = await this.db.query(TASKS_QUERIES.UPDATE, [
            input.title, input.description, input.status, input.priority,
            input.assigneeId, input.dueDate, input.position, id
        ]);
        if (!result.rows[0])
            return null;
        return this.mapRowToTask(result.rows[0]);
    }
    async softDelete(id, path) {
        const result = await this.db.query(TASKS_QUERIES.SOFT_DELETE, [id, path]);
        return result.rows.map((r) => r.id);
    }
    async getMaxPosition(listId, parentId) {
        const query = TASKS_QUERIES.GET_MAX_POSITION.replace('IS $2', parentId ? '= $2' : 'IS NULL');
        const params = parentId ? [listId, parentId] : [listId];
        const result = await this.db.query(query, params);
        return Number(result.rows[0]?.max_pos ?? 0);
    }
    mapRowToTask(row) {
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
        };
    }
}
//# sourceMappingURL=tasks.repository.js.map