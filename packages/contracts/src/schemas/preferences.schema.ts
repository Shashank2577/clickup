import { z } from 'zod'

export const UpdateUserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(30).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  firstDayOfWeek: z.number().int().min(0).max(6).optional(),
  sidebarCollapsed: z.boolean().optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  extra: z.record(z.unknown()).optional(),
})

export const UpdateWorkspaceClickAppsSchema = z.object({
  sprintsEnabled: z.boolean().optional(),
  timeTrackingEnabled: z.boolean().optional(),
  prioritiesEnabled: z.boolean().optional(),
  tagsEnabled: z.boolean().optional(),
  customFieldsEnabled: z.boolean().optional(),
  automationsEnabled: z.boolean().optional(),
  goalsEnabled: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  milestonesEnabled: z.boolean().optional(),
  mindMapsEnabled: z.boolean().optional(),
  whiteboardsEnabled: z.boolean().optional(),
  portfoliosEnabled: z.boolean().optional(),
})
