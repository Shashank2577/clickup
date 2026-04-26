import { z } from 'zod'

export const CreateSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().max(1000).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
})
export type CreateSprintSchemaType = z.infer<typeof CreateSprintSchema>

export const UpdateSprintSchema = CreateSprintSchema.partial()
export type UpdateSprintSchemaType = z.infer<typeof UpdateSprintSchema>

export const AddSprintTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(100),
})
export type AddSprintTasksSchemaType = z.infer<typeof AddSprintTasksSchema>
