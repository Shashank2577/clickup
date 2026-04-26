import { z } from 'zod'

// ============================================================
// Dashboard widget types
// ============================================================

export const WIDGET_TYPES = [
  'task_count',
  'task_by_status',
  'task_by_assignee',
  'task_by_priority',
  'completion_rate',
  'time_tracked',
  'time_by_user',
  'billable_time',
  'velocity',
  'burndown',
  'cumulative_flow',
  'overdue_tasks',
  'recent_activity',
  'goals_progress',
  'custom_text',
  'embed',
  'burnup',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

// ============================================================
// Dashboard schemas
// ============================================================

export const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  isPrivate: z.boolean().optional().default(false),
})
export type CreateDashboardSchemaType = z.infer<typeof CreateDashboardSchema>

export const UpdateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isPrivate: z.boolean().optional(),
  reportSchedule: z.object({
    enabled: z.boolean(),
    cronExpression: z.string().optional(),
    recipientEmails: z.array(z.string().email()).optional(),
    format: z.enum(['pdf', 'email']).optional().default('email'),
  }).optional(),
})
export type UpdateDashboardSchemaType = z.infer<typeof UpdateDashboardSchema>

// ============================================================
// Widget config schema — flexible JSONB config per widget type
// ============================================================

export const WidgetConfigSchema = z.object({
  // Scope filters
  listId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  // Status filter
  statuses: z.array(z.string()).optional(),
  // Date range
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // Custom text / embed
  text: z.string().optional(),
  url: z.string().url().optional(),
}).passthrough()

export type WidgetConfigType = z.infer<typeof WidgetConfigSchema>

// ============================================================
// Widget schemas
// ============================================================

export const CreateWidgetSchema = z.object({
  type: z.enum(WIDGET_TYPES),
  title: z.string().min(1).max(255),
  config: WidgetConfigSchema.optional().default({}),
  positionX: z.number().int().min(0).optional().default(0),
  positionY: z.number().int().min(0).optional().default(0),
  width: z.number().int().min(1).max(12).optional().default(4),
  height: z.number().int().min(1).max(12).optional().default(3),
})
export type CreateWidgetSchemaType = z.infer<typeof CreateWidgetSchema>

export const UpdateWidgetSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  config: WidgetConfigSchema.optional(),
  positionX: z.number().int().min(0).optional(),
  positionY: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(12).optional(),
})
export type UpdateWidgetSchemaType = z.infer<typeof UpdateWidgetSchema>
