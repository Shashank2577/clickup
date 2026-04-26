import { z } from 'zod'

export const CreateGoalSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
})
export type CreateGoalSchemaType = z.infer<typeof CreateGoalSchema>

export const UpdateGoalSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
})
export type UpdateGoalSchemaType = z.infer<typeof UpdateGoalSchema>

export const CreateGoalTargetSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['number', 'currency', 'boolean', 'task']),
  targetValue: z.number().positive().optional(),
  taskId: z.string().uuid().optional(),
  currentValue: z.number().min(0).optional()
})
export type CreateGoalTargetSchemaType = z.infer<typeof CreateGoalTargetSchema>

export const UpdateGoalTargetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  currentValue: z.number().min(0).optional(),
  targetValue: z.number().positive().optional(),
  taskId: z.string().uuid().optional()
})
export type UpdateGoalTargetSchemaType = z.infer<typeof UpdateGoalTargetSchema>
