import { z } from 'zod'

export const UpdatePreferencesSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional(),
  appearanceMode: z.enum(['light', 'dark', 'auto']).optional(),
  highContrast: z.boolean().optional(),
})

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>
