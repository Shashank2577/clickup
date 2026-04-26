import { Pool } from 'pg'

export interface DashboardTemplate {
  id: string
  name: string
  description: string | null
  category: string
  widgets: unknown[]
  isDefault: boolean
  createdAt: string
}

export function createTemplatesRepository(db: Pool) {
  return {
    async listTemplates(): Promise<DashboardTemplate[]> {
      const result = await db.query(
        `SELECT id, name, description, category, widgets, is_default AS "isDefault", created_at AS "createdAt"
         FROM dashboard_templates
         ORDER BY is_default DESC, name ASC`,
      )
      return result.rows
    },

    async getTemplate(templateId: string): Promise<DashboardTemplate | null> {
      const result = await db.query(
        `SELECT id, name, description, category, widgets, is_default AS "isDefault", created_at AS "createdAt"
         FROM dashboard_templates
         WHERE id = $1`,
        [templateId],
      )
      return result.rows[0] ?? null
    },

    async createDashboardFromTemplate(
      templateId: string,
      workspaceId: string,
      ownerId: string,
      nameOverride?: string,
    ): Promise<{ dashboard: unknown; widgetCount: number }> {
      const template = await this.getTemplate(templateId)
      if (!template) {
        return { dashboard: null, widgetCount: 0 }
      }

      const dashboardName = nameOverride ?? template.name

      // Create the dashboard
      const dashResult = await db.query(
        `INSERT INTO dashboards (workspace_id, name, is_private, owner_id, template_id)
         VALUES ($1, $2, FALSE, $3, $4)
         RETURNING *`,
        [workspaceId, dashboardName, ownerId, templateId],
      )
      const dashboard = dashResult.rows[0]

      // Create widgets from the template
      const widgets = template.widgets as Array<{
        type: string
        title: string
        positionX: number
        positionY: number
        width: number
        height: number
        config: Record<string, unknown>
      }>

      for (const w of widgets) {
        await db.query(
          `INSERT INTO dashboard_widgets (dashboard_id, type, title, config, position_x, position_y, width, height)
           VALUES ($1, $2::dashboard_widget_type, $3, $4, $5, $6, $7, $8)`,
          [
            dashboard.id,
            w.type,
            w.title,
            JSON.stringify(w.config ?? {}),
            w.positionX ?? 0,
            w.positionY ?? 0,
            w.width ?? 4,
            w.height ?? 3,
          ],
        )
      }

      return { dashboard, widgetCount: widgets.length }
    },
  }
}

export type TemplatesRepository = ReturnType<typeof createTemplatesRepository>
