import { z } from 'zod'
import { SummarizeTargetType } from '../types/enums.js'

const uuid = z.string().uuid()

// ============================================================
// AI Service Input/Output Schemas
// These define the contract for all AI capabilities.
// Other services call these endpoints — they never call LLMs directly.
// ============================================================

export const TaskBreakdownInputSchema = z.object({
  input: z.string().min(1, 'Input is required').max(2000, 'Input too long'),
  workspaceId: z.string().min(1),
  listId: uuid,
  context: z
    .object({
      existingTasks: z.array(z.string()).max(20).optional(),
      projectDescription: z.string().max(500).optional(),
    })
    .optional(),
})

export const TaskBreakdownOutputSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      estimatedMinutes: z.number().int().positive().optional(),
      subtasks: z
        .array(
          z.object({
            title: z.string(),
            estimatedMinutes: z.number().int().positive().optional(),
          }),
        )
        .optional(),
    }),
  ),
})

export const SummarizeInputSchema = z.object({
  content: z.string().min(1).max(20000),
  type: z.nativeEnum(SummarizeTargetType),
  workspaceId: z.string().min(1),
})

export const SummarizeOutputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).optional(),
})

export const PrioritizeInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      dueDate: z.string().nullable(),
      estimatedMinutes: z.number().nullable(),
      status: z.string(),
    }),
  ).min(1).max(50),
  workspaceId: z.string().min(1),
  userId: uuid,
})

export const PrioritizeOutputSchema = z.object({
  ordered: z.array(
    z.object({
      id: uuid,
      reasoning: z.string(),
    }),
  ),
})

export const DailyPlanInputSchema = z.object({
  userId: uuid,
  workspaceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  availableMinutes: z.number().int().positive().optional().default(480),
})

export const DailyPlanOutputSchema = z.object({
  plan: z.array(
    z.object({
      taskId: uuid,
      taskTitle: z.string(),
      suggestedStartTime: z.string().optional(),
      estimatedMinutes: z.number(),
      reasoning: z.string(),
    }),
  ),
  totalMinutes: z.number(),
  overloadWarning: z.boolean(),
})

export type TaskBreakdownInput = z.infer<typeof TaskBreakdownInputSchema>
export type TaskBreakdownOutput = z.infer<typeof TaskBreakdownOutputSchema>
export type SummarizeInput = z.infer<typeof SummarizeInputSchema>
export type SummarizeOutput = z.infer<typeof SummarizeOutputSchema>
export type PrioritizeInput = z.infer<typeof PrioritizeInputSchema>
export type PrioritizeOutput = z.infer<typeof PrioritizeOutputSchema>
export type DailyPlanInput = z.infer<typeof DailyPlanInputSchema>
export type DailyPlanOutput = z.infer<typeof DailyPlanOutputSchema>
