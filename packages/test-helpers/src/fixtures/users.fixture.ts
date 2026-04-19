import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'
import type { Pool, PoolClient } from 'pg'

export interface TestUser {
  id: string
  email: string
  name: string
  password: string
}

export async function createTestUser(
  db: Pool | PoolClient,
  override: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const id = randomUUID()
  const password = override.password ?? 'test-password-123'
  const email = override.email ?? `user-${id.slice(0, 8)}@test.com`
  const name = override.name ?? `Test User ${id.slice(0, 8)}`
  const passwordHash = await bcrypt.hash(password, 4)

  await db.query(
    `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
    [id, email, name, passwordHash],
  )

  return { id, email, name, password }
}
