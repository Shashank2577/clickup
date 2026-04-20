"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskStatusSchema = exports.CreateTaskStatusSchema = exports.UpdateViewUserStateSchema = exports.UpdateViewSchema = exports.CreateViewSchema = void 0;
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
const ViewConfigSchema = zod_1.z.object({
    groupById: zod_1.z.string().optional(),
    datePropertyId: zod_1.z.string().optional(),
    sortOptions: zod_1.z.array(SortOptionSchema).optional().default([]),
    visiblePropertyIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
    filter: FilterGroupSchema.optional().default({ operation: 'and', filters: [] }),
    columnWidths: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional().default({}),
    collapsedGroups: zod_1.z.array(zod_1.z.string()).optional().default([]),
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
//# sourceMappingURL=view.schema.js.map