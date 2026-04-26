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

// ============================================================
// Per-view-type config schemas
// ============================================================

const TableConfigSchema = z.object({
  inlineEditing: z.boolean().optional().default(true),
  rowHeight: z.enum(['compact', 'normal', 'tall']).optional().default('normal'),
  frozenColumns: z.number().int().min(0).max(5).optional().default(1),
})

const TimelineConfigSchema = z.object({
  startField: z.string().optional().default('start_date'),
  endField: z.string().optional().default('due_date'),
  zoom: z.enum(['day', 'week', 'month', 'quarter']).optional().default('week'),
})

const WorkloadConfigSchema = z.object({
  capacityField: z.enum(['hours', 'points']).optional().default('hours'),
  maxCapacity: z.number().optional().default(40),
  showOverallocated: z.boolean().optional().default(true),
})

const TeamConfigSchema = z.object({
  groupByUser: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  showTaskCount: z.boolean().optional().default(true),
})

const ActivityConfigSchema = z.object({
  showSystem: z.boolean().optional().default(false),
  limit: z.number().int().min(10).max(200).optional().default(50),
})

const MapConfigSchema = z.object({
  locationFieldId: z.string().optional(),
  defaultZoom: z.number().optional().default(10),
  defaultCenter: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
})

const MindmapConfigSchema = z.object({
  rootTaskId: uuid.optional(),
  layout: z.enum(['tree', 'radial']).optional().default('tree'),
})

const EmbedConfigSchema = z.object({
  url: z.string().url(),
  embedType: z.enum(['website', 'google_sheets', 'figma', 'miro', 'youtube', 'other']).optional().default('website'),
  height: z.number().int().min(200).max(2000).optional().default(600),
})

const ViewConfigSchema = z.object({
  groupById: z.string().optional(),
  datePropertyId: z.string().optional(),
  sortOptions: z.array(SortOptionSchema).optional().default([]),
  visiblePropertyIds: z.array(z.string()).optional().default([]),
  filter: FilterGroupSchema.optional().default({ operation: 'and', filters: [] }),
  columnWidths: z.record(z.string(), z.number()).optional().default({}),
  collapsedGroups: z.array(z.string()).optional().default([]),
  // Per-view-type config (only one should be set based on type)
  table: TableConfigSchema.optional(),
  timeline: TimelineConfigSchema.optional(),
  workload: WorkloadConfigSchema.optional(),
  team: TeamConfigSchema.optional(),
  activity: ActivityConfigSchema.optional(),
  map: MapConfigSchema.optional(),
  mindmap: MindmapConfigSchema.optional(),
  embed: EmbedConfigSchema.optional(),
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

export const UpdateViewSharingSchema = z.object({
  visibility: z.enum(['private', 'shared']),
  pinned: z.boolean().optional(),
})

export type CreateViewInput = z.infer<typeof CreateViewSchema>
export type UpdateViewInput = z.infer<typeof UpdateViewSchema>
export type UpdateViewSharingInput = z.infer<typeof UpdateViewSharingSchema>
export type CreateTaskStatusInput = z.infer<typeof CreateTaskStatusSchema>
