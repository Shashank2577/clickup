import { Router } from 'express'
import type { Pool } from 'pg'
import { createHash, createHmac, randomBytes } from 'crypto'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// Base32 encode/decode (RFC 4648)
// ============================================================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let result = ''
  let bits = 0
  let bitsCount = 0
  for (const byte of buffer) {
    bits = (bits << 8) | byte
    bitsCount += 8
    while (bitsCount >= 5) {
      bitsCount -= 5
      result += BASE32_CHARS[(bits >> bitsCount) & 0x1f]!
    }
  }
  if (bitsCount > 0) result += BASE32_CHARS[(bits << (5 - bitsCount)) & 0x1f]!
  return result
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, '')
  let bits = 0
  let bitsCount = 0
  const bytes: number[] = []
  for (const char of cleaned) {
    const val = BASE32_CHARS.indexOf(char)
    if (val === -1) throw new Error('Invalid base32 character: ' + char)
    bits = (bits << 5) | val
    bitsCount += 5
    if (bitsCount >= 8) {
      bitsCount -= 8
      bytes.push((bits >> bitsCount) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

// ============================================================
// TOTP implementation — RFC 6238
// ============================================================

function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

function computeTotp(secret: string, window: number = 0): string {
  const key = base32Decode(secret)
  const time = Math.floor((Date.now() / 1000 + window * 30) / 30)
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(time / 0x100000000), 0)
  counter.writeUInt32BE(time >>> 0, 4)
  const hmac = createHmac('sha1', key).update(counter).digest()
  const offset = (hmac[19]! & 0x0f)
  const otp =
    (((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff)) %
    1_000_000
  return otp.toString().padStart(6, '0')
}

function verifyTotp(secret: string, code: string): boolean {
  for (const w of [-1, 0, 1]) {
    if (computeTotp(secret, w) === code) return true
  }
  return false
}

// ============================================================
// Backup codes — 8 random hex strings, SHA-256 hashed for storage
// ============================================================

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(5).toString('hex') // 10-char hex
    plain.push(code)
    hashed.push(createHash('sha256').update(code).digest('hex'))
  }
  return { plain, hashed }
}

// ============================================================
// Router
// ============================================================

export function totpRouter(db: Pool): Router {
  const router = Router()

  // POST /auth/2fa/enable — generate TOTP secret, store unverified
  router.post(
    '/2fa/enable',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as any).auth!.userId as string

      // Overwrite any existing (unverified) secret
      const secret = generateTotpSecret()

      await db.query(
        `INSERT INTO totp_secrets (user_id, secret, verified, backup_codes)
         VALUES ($1, $2, false, '{}')
         ON CONFLICT (user_id) DO UPDATE
           SET secret = EXCLUDED.secret,
               verified = false,
               backup_codes = '{}',
               created_at = NOW()`,
        [userId, secret],
      )

      // Build otpauth URI for authenticator apps / QR codes
      const userR = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId])
      const email = userR.rows[0]?.email ?? userId
      const issuer = 'ClickUp OSS'
      const otpauthUrl =
        `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}` +
        `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

      logger.info({ userId }, '2fa: enable initiated')
      res.json({ data: { secret, otpauthUrl } })
    }),
  )

  // POST /auth/2fa/verify — confirm the code, mark verified, generate backup codes
  router.post(
    '/2fa/verify',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as any).auth!.userId as string
      const { code } = req.body as { code?: string }
      if (!code || typeof code !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'code is required')
      }

      const secretR = await db.query<{ secret: string; verified: boolean }>(
        `SELECT secret, verified FROM totp_secrets WHERE user_id = $1`,
        [userId],
      )
      const row = secretR.rows[0]
      if (!row) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, '2FA not enabled — call /auth/2fa/enable first')
      }

      if (!verifyTotp(row.secret, code)) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid TOTP code')
      }

      const { plain, hashed } = generateBackupCodes()

      await db.query(
        `UPDATE totp_secrets SET verified = true, backup_codes = $1 WHERE user_id = $2`,
        [hashed, userId],
      )

      logger.info({ userId }, '2fa: verified and enabled')
      res.json({ data: { verified: true, backupCodes: plain } })
    }),
  )

  // POST /auth/2fa/disable — verify code then remove TOTP secret
  router.post(
    '/2fa/disable',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as any).auth!.userId as string
      const { code } = req.body as { code?: string }
      if (!code || typeof code !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'code is required')
      }

      const secretR = await db.query<{ secret: string; verified: boolean }>(
        `SELECT secret, verified FROM totp_secrets WHERE user_id = $1`,
        [userId],
      )
      const row = secretR.rows[0]
      if (!row || !row.verified) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, '2FA is not active for this account')
      }

      if (!verifyTotp(row.secret, code)) {
        throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid TOTP code')
      }

      await db.query(`DELETE FROM totp_secrets WHERE user_id = $1`, [userId])

      logger.info({ userId }, '2fa: disabled')
      res.json({ data: { disabled: true } })
    }),
  )

  // POST /auth/2fa/validate — validate TOTP or backup code for login step
  router.post(
    '/2fa/validate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as any).auth!.userId as string
      const { code } = req.body as { code?: string }
      if (!code || typeof code !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'code is required')
      }

      const secretR = await db.query<{ secret: string; verified: boolean; backup_codes: string[] }>(
        `SELECT secret, verified, backup_codes FROM totp_secrets WHERE user_id = $1`,
        [userId],
      )
      const row = secretR.rows[0]
      if (!row || !row.verified) {
        res.json({ data: { valid: false } })
        return
      }

      // First try TOTP
      if (verifyTotp(row.secret, code)) {
        res.json({ data: { valid: true } })
        return
      }

      // Try backup codes (SHA-256 match)
      const codeHash = createHash('sha256').update(code).digest('hex')
      const backupCodes: string[] = row.backup_codes ?? []
      const matchIndex = backupCodes.findIndex((h) => h === codeHash)

      if (matchIndex !== -1) {
        // Consume the backup code (remove it)
        const updatedCodes = backupCodes.filter((_, i) => i !== matchIndex)
        await db.query(`UPDATE totp_secrets SET backup_codes = $1 WHERE user_id = $2`, [updatedCodes, userId])
        logger.info({ userId }, '2fa: backup code consumed')
        res.json({ data: { valid: true, backupCodeUsed: true } })
        return
      }

      res.json({ data: { valid: false } })
    }),
  )

  return router
}
