import { z } from 'zod'

const uuid = z.string().uuid()

// ============================================================
// Notification enhancement schemas
// ============================================================

export const SnoozeNotificationSchema = z.object({
  snoozeUntil: z.string().datetime(),
})

export type SnoozeNotificationInput = z.infer<typeof SnoozeNotificationSchema>

// ============================================================
// Reminder schemas
// ============================================================

export const CreateReminderSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  remindAt: z.string().datetime(),
  entityType: z.enum(['task', 'doc', 'comment', 'custom']).optional(),
  entityId: uuid.optional(),
})

export const UpdateReminderSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  remindAt: z.string().datetime().optional(),
  isCompleted: z.boolean().optional(),
})

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>
export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>
