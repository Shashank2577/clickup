import { z } from 'zod'

const uuid = z.string().uuid()

const FormFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'email', 'url', 'checkbox']),
  label: z.string().min(1).max(200),
  required: z.boolean().optional().default(false),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string()).optional(),
  taskField: z.enum(['title', 'description', 'priority', 'due_date', 'assignee_id', 'tags', 'custom']).optional(),
  customFieldId: uuid.optional(),
})

export const CreateTaskFormSchema = z.object({
  listId: uuid,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(FormFieldSchema).min(1).max(50),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
})

export const UpdateTaskFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(FormFieldSchema).optional(),
  isActive: z.boolean().optional(),
})

export const SubmitFormSchema = z.object({
  data: z.record(z.unknown()),
})

export type CreateTaskFormInput = z.infer<typeof CreateTaskFormSchema>
export type UpdateTaskFormInput = z.infer<typeof UpdateTaskFormSchema>
export type SubmitFormInput = z.infer<typeof SubmitFormSchema>

// ============================================================
// Form-service schemas (richer form model)
// ============================================================

const FormServiceFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'text', 'number', 'dropdown', 'checkbox', 'date',
    'email', 'phone', 'url', 'rating', 'file_upload',
  ]),
  label: z.string().min(1).max(200),
  required: z.boolean().optional().default(false),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  taskField: z.enum(['title', 'description', 'priority', 'due_date', 'assignee_id', 'tags', 'custom']).optional(),
  customFieldId: uuid.optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
})

export const CreateFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  listId: uuid,
  fields: z.array(FormServiceFieldSchema).min(1).max(50),
})

export const UpdateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(FormServiceFieldSchema).optional(),
  isActive: z.boolean().optional(),
})

export const SubmitFormResponseSchema = z.object({
  data: z.record(z.unknown()),
  submittedBy: z.string().max(200).optional(),
})

export type CreateFormInput = z.infer<typeof CreateFormSchema>
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>
export type SubmitFormResponseInput = z.infer<typeof SubmitFormResponseSchema>
