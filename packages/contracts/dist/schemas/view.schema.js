"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateViewSharingSchema = exports.UpdateTaskStatusSchema = exports.CreateTaskStatusSchema = exports.UpdateViewUserStateSchema = exports.UpdateViewSchema = exports.CreateViewSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../types/enums.js");
const uuid = zod_1.z.string().uuid();
// Recursive FilterGroup schema
const FilterClauseSchema = zod_1.z.object({
    propertyId: zod_1.z.string().min(1),
    condition: zod_1.z.nativeEnum(enums_js_1.FilterCondition),
    values: zod_1.z.array(zod_1.z.string()),
});
// Forward reference for recursive type
const FilterGroupSchema = zod_1.z.lazy(() => zod_1.z.object({
    operation: zod_1.z.enum(['and', 'or']),
    filters: zod_1.z.array(zod_1.z.union([FilterClauseSchema, FilterGroupSchema])),
}));
const SortOptionSchema = zod_1.z.object({
    propertyId: zod_1.z.string().min(1),
    direction: zod_1.z.enum(['asc', 'desc']),
});
// ============================================================
// Per-view-type config schemas
// ============================================================
const TableConfigSchema = zod_1.z.object({
    inlineEditing: zod_1.z.boolean().optional().default(true),
    rowHeight: zod_1.z.enum(['compact', 'normal', 'tall']).optional().default('normal'),
    frozenColumns: zod_1.z.number().int().min(0).max(5).optional().default(1),
});
const TimelineConfigSchema = zod_1.z.object({
    startField: zod_1.z.string().optional().default('start_date'),
    endField: zod_1.z.string().optional().default('due_date'),
    zoom: zod_1.z.enum(['day', 'week', 'month', 'quarter']).optional().default('week'),
});
const WorkloadConfigSchema = zod_1.z.object({
    capacityField: zod_1.z.enum(['hours', 'points']).optional().default('hours'),
    maxCapacity: zod_1.z.number().optional().default(40),
    showOverallocated: zod_1.z.boolean().optional().default(true),
});
const TeamConfigSchema = zod_1.z.object({
    groupByUser: zod_1.z.boolean().optional().default(true),
    showAvatar: zod_1.z.boolean().optional().default(true),
    showTaskCount: zod_1.z.boolean().optional().default(true),
});
const ActivityConfigSchema = zod_1.z.object({
    showSystem: zod_1.z.boolean().optional().default(false),
    limit: zod_1.z.number().int().min(10).max(200).optional().default(50),
});
const MapConfigSchema = zod_1.z.object({
    locationFieldId: zod_1.z.string().optional(),
    defaultZoom: zod_1.z.number().optional().default(10),
    defaultCenter: zod_1.z.object({
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
    }).optional(),
});
const MindmapConfigSchema = zod_1.z.object({
    rootTaskId: uuid.optional(),
    layout: zod_1.z.enum(['tree', 'radial']).optional().default('tree'),
});
const EmbedConfigSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    embedType: zod_1.z.enum(['website', 'google_sheets', 'figma', 'miro', 'youtube', 'other']).optional().default('website'),
    height: zod_1.z.number().int().min(200).max(2000).optional().default(600),
});
const ViewConfigSchema = zod_1.z.object({
    groupById: zod_1.z.string().optional(),
    datePropertyId: zod_1.z.string().optional(),
    sortOptions: zod_1.z.array(SortOptionSchema).optional().default([]),
    visiblePropertyIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
    filter: FilterGroupSchema.optional().default({ operation: 'and', filters: [] }),
    columnWidths: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional().default({}),
    collapsedGroups: zod_1.z.array(zod_1.z.string()).optional().default([]),
    // Per-view-type config (only one should be set based on type)
    table: TableConfigSchema.optional(),
    timeline: TimelineConfigSchema.optional(),
    workload: WorkloadConfigSchema.optional(),
    team: TeamConfigSchema.optional(),
    activity: ActivityConfigSchema.optional(),
    map: MapConfigSchema.optional(),
    mindmap: MindmapConfigSchema.optional(),
    embed: EmbedConfigSchema.optional(),
});
exports.CreateViewSchema = zod_1.z.object({
    listId: uuid.optional(),
    name: zod_1.z.string().min(1).max(100).trim(),
    type: zod_1.z.nativeEnum(enums_js_1.ViewType).default(enums_js_1.ViewType.List),
    config: ViewConfigSchema.optional().default({}),
    isPrivate: zod_1.z.boolean().optional().default(false),
});
exports.UpdateViewSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    config: ViewConfigSchema.optional(),
    isPrivate: zod_1.z.boolean().optional(),
});
exports.UpdateViewUserStateSchema = zod_1.z.object({
    collapsedGroups: zod_1.z.array(zod_1.z.string()).optional(),
    hiddenColumns: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.CreateTaskStatusSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
    group: zod_1.z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']).optional().default('unstarted'),
});
exports.UpdateTaskStatusSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    group: zod_1.z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']).optional(),
    position: zod_1.z.number().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.UpdateViewSharingSchema = zod_1.z.object({
    visibility: zod_1.z.enum(['private', 'shared']),
    pinned: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=view.schema.js.map