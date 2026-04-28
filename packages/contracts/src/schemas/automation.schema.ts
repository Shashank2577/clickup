import { z } from 'zod'

export const AutomationTriggerTypeSchema = z.enum([
  'task_created',
  'task_status_changed',
  'task_field_changed',
  'task_assigned',
  'comment_created',
  'workspace_member_added',
])

export const AutomationActionTypeSchema = z.enum([
  'change_status',
  'assign_user',
  'update_field',
  'add_comment',
  'create_task',
  'send_notification',
  'webhook',
])

export const AutomationConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']),
  value: z.any().optional(),
})

export const AutomationActionSchema = z.object({
  type: AutomationActionTypeSchema,
  config: z.record(z.any()),
})

export const CreateAutomationSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  triggerType: AutomationTriggerTypeSchema,
  triggerConfig: z.record(z.any()).default({}),
  conditions: z.array(AutomationConditionSchema).default([]),
  actions: z.array(AutomationActionSchema).min(1),
})

export const UpdateAutomationSchema = CreateAutomationSchema.partial()
