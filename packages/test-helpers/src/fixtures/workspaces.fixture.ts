import { randomUUID } from 'crypto'
import type { Pool, PoolClient } from 'pg'

export interface TestWorkspace {
  id: string
  slug: string
  name: string
}

export interface TestSpace {
  id: string
}

export interface TestList {
  id: string
}

export async function createTestWorkspace(
  db: Pool | PoolClient,
  ownerId: string,
): Promise<TestWorkspace> {
  const id = randomUUID()
  const slug = `ws-${id.slice(0, 8)}`
  const name = `Workspace ${slug}`

  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, $2, $3, $4)`,
    [id, name, slug, ownerId],
  )
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [id, ownerId],
  )

  return { id, slug, name }
}

export async function createTestSpace(
  db: Pool | PoolClient,
  workspaceId: string,
  createdBy: string,
): Promise<TestSpace> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO spaces (id, workspace_id, name, color, created_by) VALUES ($1, $2, $3, '#6366f1', $4)`,
    [id, workspaceId, `Space ${id.slice(0, 8)}`, createdBy],
  )
  return { id }
}

export async function createTestList(
  db: Pool | PoolClient,
  spaceId: string,
  createdBy: string,
): Promise<TestList> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO lists (id, space_id, name, created_by) VALUES ($1, $2, $3, $4)`,
    [id, spaceId, `List ${id.slice(0, 8)}`, createdBy],
  )

  const statuses = [
    { name: 'Todo', color: '#64748b', group: 'unstarted', position: 1000, isDefault: true },
    { name: 'In Progress', color: '#3b82f6', group: 'started', position: 2000, isDefault: false },
    { name: 'Done', color: '#22c55e', group: 'completed', position: 3000, isDefault: false },
  ]
  for (const s of statuses) {
    await db.query(
      `INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [id, s.name, s.color, s.group, s.position, s.isDefault],
    )
  }

  return { id }
}
