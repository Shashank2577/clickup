"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestWorkspace = createTestWorkspace;
exports.createTestSpace = createTestSpace;
exports.createTestList = createTestList;
const crypto_1 = require("crypto");
async function createTestWorkspace(db, ownerId) {
    const id = (0, crypto_1.randomUUID)();
    const slug = `ws-${id.slice(0, 8)}`;
    const name = `Workspace ${slug}`;
    await db.query(`INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, $2, $3, $4)`, [id, name, slug, ownerId]);
    await db.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [id, ownerId]);
    return { id, slug, name };
}
async function createTestSpace(db, workspaceId, createdBy) {
    const id = (0, crypto_1.randomUUID)();
    await db.query(`INSERT INTO spaces (id, workspace_id, name, color, created_by) VALUES ($1, $2, $3, '#6366f1', $4)`, [id, workspaceId, `Space ${id.slice(0, 8)}`, createdBy]);
    return { id };
}
async function createTestList(db, spaceId, createdBy) {
    const id = (0, crypto_1.randomUUID)();
    await db.query(`INSERT INTO lists (id, space_id, name, created_by) VALUES ($1, $2, $3, $4)`, [id, spaceId, `List ${id.slice(0, 8)}`, createdBy]);
    const statuses = [
        { name: 'Todo', color: '#64748b', group: 'unstarted', position: 1000, isDefault: true },
        { name: 'In Progress', color: '#3b82f6', group: 'started', position: 2000, isDefault: false },
        { name: 'Done', color: '#22c55e', group: 'completed', position: 3000, isDefault: false },
    ];
    for (const s of statuses) {
        await db.query(`INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`, [id, s.name, s.color, s.group, s.position, s.isDefault]);
    }
    return { id };
}
//# sourceMappingURL=workspaces.fixture.js.map