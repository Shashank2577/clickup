import { z } from 'zod'
import { ViewType, FilterCondition } from '../types/enums.js'

const uuid = z.string().uuid()

// Recursive FilterGroup schema
const FilterClauseSchema = z.object({
  propertyId: z.string().min(1),
  condition: z.nativeEnum(FilterCondition),
  values: z.array(z.string()),
})

// Forward reference for recursive type
const FilterGroupSchema: z.ZodType<{
  operation: 'and' | 'or'
  filters: Array<z.infer<typeof FilterClauseSchema> | { operation: 'and' | 'or'; filters: unknown[] }>
}> = z.lazy(() =>
  z.object({
    operation: z.enum(['and', 'or']),
    filters: z.array(z.union([FilterClauseSchema, FilterGroupSchema])),
  }),
)

const SortOptionSchema = z.object({
  propertyId: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
})

const ViewConfigSchema = z.object({
  groupById: z.string().optional(),
  datePropertyId: z.string().optional(),
  sortOptions: z.array(SortOptionSchema).optional().default([]),
  visiblePropertyIds: z.array(z.string()).optional().default([]),
  filter: FilterGroupSchema.optional().default({ operation: 'and', filters: [] }),
  columnWidths: z.record(z.string(), z.number()).optional().default({}),
  collapsedGroups: z.array(z.string()).optional().default([]),
})

export const CreateViewSchema = z.object({
  listId: uuid.optional(),
  name: z.string().min(1).max(100).trim(),
  type: z.nativeEnum(ViewType).default(ViewType.List),
  config: ViewConfigSchema.optional().default({}),
  isPrivate: z.boolean().optional().default(false),
})

export const UpdateViewSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  config: ViewConfigSchema.optional(),
  isPrivate: z.boolean().optional(),
})

export const UpdateViewUserStateSchema = z.object({
  collapsedGroups: z.array(z.string()).optional(),
  hiddenColumns: z.array(z.string()).optional(),
})

export const CreateTaskStatusSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
  group: z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']).optional().default('unstarted'),
})

export const UpdateTaskStatusSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  group: z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']).optional(),
  position: z.number().optional(),
  isDefault: z.boolean().optional(),
})

export type CreateViewInput = z.infer<typeof CreateViewSchema>
export type UpdateViewInput = z.infer<typeof UpdateViewSchema>
export type CreateTaskStatusInput = z.infer<typeof CreateTaskStatusSchema>
