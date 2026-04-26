import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().datetime({ offset: true })

export const CreateTaskTemplateSchema = z.object({
  workspaceId: uuid,
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  templateData: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(50000).optional(),
    priority: z.string().optional(),
    estimatedMinutes: z.number().int().positive().optional(),
    tags: z.array(z.string()).optional(),
    checklists: z.array(z.object({
      title: z.string(),
      items: z.array(z.object({ title: z.string() })),
    })).optional(),
  }),
})

export const UpdateTaskTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  templateData: z.record(z.unknown()).optional(),
})

export type CreateTaskTemplateInput = z.infer<typeof CreateTaskTemplateSchema>
export type UpdateTaskTemplateInput = z.infer<typeof UpdateTaskTemplateSchema>
