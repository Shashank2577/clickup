import { Pool, PoolClient } from 'pg'
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'

let _pool: Pool | null = null

export function getTestDb(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgres://clickup:clickup@localhost:5432/clickup_test',
      max: 5,
    })
  }
  return _pool
}

export async function closeTestDb(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}

export async function withRollback<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getTestDb()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    return result
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

export async function setupTestDb(): Promise<void> {
  const pool = getTestDb()
  const migrationsDir = resolve(process.cwd(), '../../infra/migrations')
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf-8')
    await pool.query(sql)
  }

  await closeTestDb()
}
