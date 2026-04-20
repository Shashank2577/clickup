import type { Request, Response } from 'express'
import type { Pool } from 'pg'
import { getRedis } from '../cache/client.js'
import { getNats } from '../events/publisher.js'
import { logger } from '../logging/logger.js'

// ============================================================
// Health check endpoint — mount at GET /health
// Returns 200 if all deps are reachable, 503 otherwise.
// ============================================================

interface HealthStatus {
  status: 'ok' | 'degraded'
  service: string
  timestamp: string
  checks: {
    postgres: 'ok' | 'fail'
    redis: 'ok' | 'fail'
    nats: 'ok' | 'fail'
  }
}

export function createHealthHandler(db: Pool) {
  return async function healthHandler(_req: Request, res: Response): Promise<void> {
    const service = process.env['SERVICE_NAME'] ?? 'unknown'
    const checks: HealthStatus['checks'] = {
      postgres: 'fail',
      redis: 'fail',
      nats: 'fail',
    }

    await Promise.all([
      db.query('SELECT 1').then(() => { checks.postgres = 'ok' }).catch((err) => {
        logger.error({ err }, 'Health check: postgres failed')
      }),
      getRedis().ping().then(() => { checks.redis = 'ok' }).catch((err) => {
        logger.error({ err }, 'Health check: redis failed')
      }),
      getNats().then(() => { checks.nats = 'ok' }).catch((err) => {
        logger.error({ err }, 'Health check: nats failed')
      }),
    ])

    const allOk = Object.values(checks).every((v) => v === 'ok')
    const status: HealthStatus = {
      status: allOk ? 'ok' : 'degraded',
      service,
      timestamp: new Date().toISOString(),
      checks,
    }

    res.status(allOk ? 200 : 503).json(status)
  }
}
