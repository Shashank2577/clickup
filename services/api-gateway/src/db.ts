import { Pool } from 'pg'

/**
 * Singleton DB pool for the API gateway.
 * Used only for API key validation — keeps overhead minimal.
 */
export const db = new Pool({
  host:                   process.env['POSTGRES_HOST']     ?? 'localhost',
  port:                   parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  database:               process.env['POSTGRES_DB']       ?? 'clickup',
  user:                   process.env['POSTGRES_USER']     ?? 'clickup',
  password:               process.env['POSTGRES_PASSWORD'] ?? 'clickup_dev',
  max:                    5,          // small pool — only for key lookups
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 3_000,
})
