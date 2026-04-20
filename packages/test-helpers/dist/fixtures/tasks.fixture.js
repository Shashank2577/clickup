"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestTask = createTestTask;
exports.createTestComment = createTestComment;
const crypto_1 = require("crypto");
async function createTestTask(db, listId, createdBy, override = {}) {
    const id = (0, crypto_1.randomUUID)();
    const path = override.parentPath
        ? `${override.parentPath}${id}/`
        : `/${listId}/${id}/`;
    await db.query(`INSERT INTO tasks (id, list_id, path, title, status, priority, created_by, version)
     VALUES ($1, $2, $3, $4, 'todo', $5, $6, 0)`, [id, listId, path, override.title ?? `Task ${id.slice(0, 8)}`, override.priority ?? 'none', createdBy]);
    const seqResult = await db.query(`INSERT INTO task_sequences (list_id, seq_id, task_id)
     VALUES ($1, COALESCE((SELECT MAX(seq_id) FROM task_sequences WHERE list_id = $1), 0) + 1, $2)
     RETURNING seq_id`, [listId, id]);
    const seqId = seqResult.rows[0].seq_id;
    await db.query(`UPDATE tasks SET seq_id = $1 WHERE id = $2`, [seqId, id]);
    return { id, path, seqId };
}
async function createTestComment(db, taskId, authorId, body = 'Test comment body') {
    const id = (0, crypto_1.randomUUID)();
    await db.query(`INSERT INTO comments (id, task_id, body, author_id) VALUES ($1, $2, $3, $4)`, [id, taskId, body, authorId]);
    return { id };
}
//# sourceMappingURL=tasks.fixture.js.map