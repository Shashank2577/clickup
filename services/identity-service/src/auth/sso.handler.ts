import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, AppError, logger } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'

// ============================================================
// SSO / SAML config CRUD
// Mounted at /auth, so routes are /auth/sso/:workspaceId/...
// ============================================================

interface SamlConfigRow {
  id: string
  workspace_id: string
  idp_entity_id: string
  idp_sso_url: string
  idp_certificate: string
  sp_entity_id: string
  attribute_mapping: Record<string, string>
  enabled: boolean
  created_by: string
  created_at: Date
  updated_at: Date
}

function toSamlConfigDto(row: SamlConfigRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    idpEntityId: row.idp_entity_id,
    idpSsoUrl: row.idp_sso_url,
    idpCertificate: row.idp_certificate,
    spEntityId: row.sp_entity_id,
    attributeMapping: row.attribute_mapping,
    enabled: row.enabled,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

async function requireWorkspaceAdmin(db: Pool, workspaceId: string, userId: string): Promise<void> {
  const memberR = await db.query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  )
  const member = memberR.rows[0]
  if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
  if (!['owner', 'admin'].includes(member.role)) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
}

export function ssoRouter(db: Pool): Router {
  const router = Router()

  // GET /auth/sso/:workspaceId/config — fetch SAML config
  router.get(
    '/sso/:workspaceId/config',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = (req as any).auth!.userId as string

      await requireWorkspaceAdmin(db, workspaceId, userId)

      const r = await db.query<SamlConfigRow>(
        `SELECT id, workspace_id, idp_entity_id, idp_sso_url, idp_certificate, sp_entity_id,
                attribute_mapping, enabled, created_by, created_at, updated_at
         FROM saml_configs
         WHERE workspace_id = $1`,
        [workspaceId],
      )
      if (!r.rows[0]) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'No SAML config found for this workspace')
      }

      res.json({ data: toSamlConfigDto(r.rows[0]) })
    }),
  )

  // PUT /auth/sso/:workspaceId/config — upsert SAML config
  router.put(
    '/sso/:workspaceId/config',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = (req as any).auth!.userId as string

      await requireWorkspaceAdmin(db, workspaceId, userId)

      const body = req.body as {
        idpEntityId?: string
        idpSsoUrl?: string
        idpCertificate?: string
        spEntityId?: string
        attributeMapping?: Record<string, string>
        enabled?: boolean
      }

      if (!body.idpEntityId || !body.idpSsoUrl || !body.idpCertificate || !body.spEntityId) {
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_INPUT,
          'idpEntityId, idpSsoUrl, idpCertificate, and spEntityId are required',
        )
      }

      const r = await db.query<SamlConfigRow>(
        `INSERT INTO saml_configs
           (workspace_id, idp_entity_id, idp_sso_url, idp_certificate, sp_entity_id, attribute_mapping, enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (workspace_id) DO UPDATE
           SET idp_entity_id     = EXCLUDED.idp_entity_id,
               idp_sso_url       = EXCLUDED.idp_sso_url,
               idp_certificate   = EXCLUDED.idp_certificate,
               sp_entity_id      = EXCLUDED.sp_entity_id,
               attribute_mapping = EXCLUDED.attribute_mapping,
               enabled           = EXCLUDED.enabled,
               updated_at        = NOW()
         RETURNING id, workspace_id, idp_entity_id, idp_sso_url, idp_certificate, sp_entity_id,
                   attribute_mapping, enabled, created_by, created_at, updated_at`,
        [
          workspaceId,
          body.idpEntityId,
          body.idpSsoUrl,
          body.idpCertificate,
          body.spEntityId,
          JSON.stringify(body.attributeMapping ?? { email: 'email', firstName: 'firstName', lastName: 'lastName' }),
          body.enabled ?? false,
          userId,
        ],
      )

      logger.info({ workspaceId, userId }, 'sso: config upserted')
      res.json({ data: toSamlConfigDto(r.rows[0]!) })
    }),
  )

  // DELETE /auth/sso/:workspaceId/config — remove SAML config
  router.delete(
    '/sso/:workspaceId/config',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = (req as any).auth!.userId as string

      await requireWorkspaceAdmin(db, workspaceId, userId)

      const r = await db.query(
        `DELETE FROM saml_configs WHERE workspace_id = $1`,
        [workspaceId],
      )
      if (r.rowCount === 0) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'No SAML config found for this workspace')
      }

      logger.info({ workspaceId, userId }, 'sso: config deleted')
      res.status(204).end()
    }),
  )

  // GET /auth/sso/:workspaceId/metadata — return SP metadata XML for IdP configuration
  router.get(
    '/sso/:workspaceId/metadata',
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params as { workspaceId: string }

      const r = await db.query<{ sp_entity_id: string; workspace_id: string }>(
        `SELECT sp_entity_id, workspace_id FROM saml_configs WHERE workspace_id = $1`,
        [workspaceId],
      )
      const config = r.rows[0]
      if (!config) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'No SAML config found for this workspace')
      }

      const baseUrl =
        process.env['BASE_URL'] ?? 'http://localhost:3001'
      const acsUrl = `${baseUrl}/api/v1/auth/sso/${workspaceId}/acs`
      const entityId = config.sp_entity_id

      const xml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`

      res.setHeader('Content-Type', 'application/xml')
      res.send(xml)
    }),
  )

  return router
}
