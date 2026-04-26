import { z } from 'zod'

// Simplified cron presets + custom cron expression
export const RecurringFrequency = z.enum(['daily', 'weekly', 'monthly', 'custom'])

export const CreateRecurringConfigSchema = z.object({
  frequency: RecurringFrequency,
  cronExpr: z.string().min(5).max(100).optional(), // required when frequency='custom'
  isActive: z.boolean().optional().default(true),
}).refine(
  (d) => d.frequency !== 'custom' || !!d.cronExpr,
  { message: 'cronExpr required when frequency is custom' },
)

export const UpdateRecurringConfigSchema = z.object({
  frequency: RecurringFrequency.optional(),
  cronExpr: z.string().min(5).max(100).optional(),
  isActive: z.boolean().optional(),
})

// Frequency → cron mapping
export const FREQUENCY_CRON_MAP: Record<string, string> = {
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  monthly: '0 9 1 * *',
}

export type CreateRecurringConfigInput = z.infer<typeof CreateRecurringConfigSchema>
export type UpdateRecurringConfigInput = z.infer<typeof UpdateRecurringConfigSchema>
