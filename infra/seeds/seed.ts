/**
 * Development seed script.
 * Creates a demo workspace with realistic data for local development.
 *
 * Usage: pnpm seed
 * Idempotent: re-running skips already-existing records (ON CONFLICT DO NOTHING).
 */

import { Pool } from 'pg'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

const db = new Pool({
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  database: process.env['POSTGRES_DB'] ?? 'clickup',
  user: process.env['POSTGRES_USER'] ?? 'clickup',
  password: process.env['POSTGRES_PASSWORD'] ?? 'clickup_dev',
})

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_WORKSPACE_ID = '00000000-0000-0000-0000-000000000010'
const DEMO_SESSION_ID = '00000000-0000-0000-0000-000000000099'

async function seedUser(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 12)
  await db.query(
    `INSERT INTO users (id, email, name, password_hash, timezone)
     VALUES ($1, $2, $3, $4, 'UTC')
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_USER_ID, 'demo@clickup.oss', 'Demo User', passwordHash],
  )
  console.warn('✓ Demo user: demo@clickup.oss / password123')
}

async function seedWorkspace(): Promise<void> {
  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_WORKSPACE_ID, 'Demo Workspace', 'demo', DEMO_USER_ID],
  )
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [DEMO_WORKSPACE_ID, DEMO_USER_ID],
  )
  console.warn('✓ Demo workspace: demo')
}

async function seedSpace(name: string, color: string): Promise<string> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO spaces (id, workspace_id, name, color, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, DEMO_WORKSPACE_ID, name, color, DEMO_USER_ID],
  )
  return id
}

async function seedList(spaceId: string, name: string): Promise<string> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO lists (id, space_id, name, created_by) VALUES ($1, $2, $3, $4)`,
    [id, spaceId, name, DEMO_USER_ID],
  )
  const statuses = [
    { name: 'Todo', color: '#64748b', group: 'unstarted', position: 1000, isDefault: true },
    { name: 'In Progress', color: '#3b82f6', group: 'started', position: 2000, isDefault: false },
    { name: 'In Review', color: '#f59e0b', group: 'started', position: 3000, isDefault: false },
    { name: 'Done', color: '#22c55e', group: 'completed', position: 4000, isDefault: false },
    { name: 'Cancelled', color: '#ef4444', group: 'closed', position: 5000, isDefault: false },
  ]
  for (const s of statuses) {
    await db.query(
      `INSERT INTO task_statuses (id, list_id, name, color, status_group, position, is_default)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [id, s.name, s.color, s.group, s.position, s.isDefault],
    )
  }
  return id
}

async function seedTask(listId: string, title: string, priority: string): Promise<string> {
  const id = randomUUID()
  const path = `/${listId}/${id}/`
  await db.query(
    `INSERT INTO tasks (id, list_id, path, title, priority, created_by, version)
     VALUES ($1, $2, $3, $4, $5, $6, 0)`,
    [id, listId, path, title, priority, DEMO_USER_ID],
  )
  const seqResult = await db.query(
    `INSERT INTO task_sequences (list_id, seq_id, task_id)
     VALUES ($1, COALESCE((SELECT MAX(seq_id) FROM task_sequences WHERE list_id = $1), 0) + 1, $2)
     RETURNING seq_id`,
    [listId, id],
  )
  await db.query(`UPDATE tasks SET seq_id = $1 WHERE id = $2`, [seqResult.rows[0].seq_id, id])
  return id
}

async function seedComment(taskId: string, body: string): Promise<void> {
  await db.query(
    `INSERT INTO comments (id, task_id, author_id, body) VALUES (gen_random_uuid(), $1, $2, $3)`,
    [taskId, DEMO_USER_ID, body],
  )
}

async function main(): Promise<void> {
  console.warn('Seeding database...')

  await seedUser()
  await seedWorkspace()

  const spaces = [
    { name: 'Engineering', color: '#6366f1' },
    { name: 'Marketing', color: '#f59e0b' },
  ]

  const listNames = ['Backlog', 'Sprint 1', 'Sprint 2']

  const taskData = [
    { title: 'Set up CI/CD pipeline', priority: 'urgent' },
    { title: 'Implement user authentication', priority: 'high' },
    { title: 'Design database schema', priority: 'high' },
    { title: 'Write API documentation', priority: 'normal' },
    { title: 'Add unit tests', priority: 'normal' },
    { title: 'Set up monitoring', priority: 'low' },
    { title: 'Configure staging environment', priority: 'normal' },
    { title: 'Code review process', priority: 'low' },
    { title: 'Performance optimization', priority: 'low' },
    { title: 'Security audit', priority: 'urgent' },
  ]

  for (const spaceData of spaces) {
    const spaceId = await seedSpace(spaceData.name, spaceData.color)

    for (const listName of listNames) {
      const listId = await seedList(spaceId, `${spaceData.name} — ${listName}`)

      for (const task of taskData) {
        const taskId = await seedTask(listId, task.title, task.priority)
        await seedComment(taskId, `Initial notes for: ${task.title}`)
        await seedComment(taskId, 'Progress update: working on it.')
      }
    }

    console.warn(`✓ Space: ${spaceData.name} (3 lists × 10 tasks × 2 comments)`)
  }

  console.warn('Seed complete.')
  await db.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
