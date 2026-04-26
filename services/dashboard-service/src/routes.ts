import { Router } from 'express'
import { requireAuth } from '@clickup/sdk'
import {
  createDashboardHandler,
  listDashboardsHandler,
  getDashboardHandler,
  updateDashboardHandler,
  deleteDashboardHandler,
} from './dashboards/dashboards.handler.js'
import {
  addWidgetHandler,
  updateWidgetHandler,
  deleteWidgetHandler,
  getWidgetDataHandler,
} from './widgets/widgets.handler.js'
import {
  listTemplatesHandler,
  createFromTemplateHandler,
} from './templates/templates.handler.js'

export function routes(): Router {
  const router = Router()

  // --------------------------------------------------------
  // Dashboard template endpoints
  // --------------------------------------------------------
  router.get('/dashboard-templates', listTemplatesHandler)
  router.post(
    '/workspaces/:workspaceId/dashboards/from-template/:templateId',
    requireAuth,
    createFromTemplateHandler,
  )

  // --------------------------------------------------------
  // Dashboard endpoints
  // --------------------------------------------------------
  // POST   /workspaces/:workspaceId/dashboards
  // GET    /workspaces/:workspaceId/dashboards
  router.post('/workspaces/:workspaceId/dashboards', requireAuth, createDashboardHandler)
  router.get('/workspaces/:workspaceId/dashboards', requireAuth, listDashboardsHandler)

  // GET    /:dashboardId
  // PATCH  /:dashboardId
  // DELETE /:dashboardId
  router.get('/:dashboardId', requireAuth, getDashboardHandler)
  router.patch('/:dashboardId', requireAuth, updateDashboardHandler)
  router.delete('/:dashboardId', requireAuth, deleteDashboardHandler)

  // --------------------------------------------------------
  // Widget endpoints
  // --------------------------------------------------------
  // POST   /:dashboardId/widgets
  router.post('/:dashboardId/widgets', requireAuth, addWidgetHandler)

  // GET    /:dashboardId/widgets/:widgetId/data
  router.get('/:dashboardId/widgets/:widgetId/data', requireAuth, getWidgetDataHandler)

  // PATCH  /widgets/:widgetId
  // DELETE /widgets/:widgetId
  router.patch('/widgets/:widgetId', requireAuth, updateWidgetHandler)
  router.delete('/widgets/:widgetId', requireAuth, deleteWidgetHandler)

  return router
}
