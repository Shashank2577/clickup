import pino from 'pino'
import pinoHttp from 'pino-http'

// ============================================================
// Structured logger — all services use this, never console.log
// ============================================================

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: {
    service: process.env['SERVICE_NAME'] ?? 'unknown',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
})

// ============================================================
// HTTP request logger middleware
// Mount before routes: app.use(httpLogger)
// ============================================================

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode}: ${err.message}`,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password'],
    censor: '[REDACTED]',
  },
})
