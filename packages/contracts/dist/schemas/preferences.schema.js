"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkspaceClickAppsSchema = exports.UpdateUserPreferencesSchema = void 0;
const zod_1 = require("zod");
exports.UpdateUserPreferencesSchema = zod_1.z.object({
    theme: zod_1.z.enum(['light', 'dark', 'system']).optional(),
    language: zod_1.z.string().max(10).optional(),
    timezone: zod_1.z.string().max(50).optional(),
    dateFormat: zod_1.z.string().max(30).optional(),
    timeFormat: zod_1.z.enum(['12h', '24h']).optional(),
    firstDayOfWeek: zod_1.z.number().int().min(0).max(6).optional(),
    sidebarCollapsed: zod_1.z.boolean().optional(),
    density: zod_1.z.enum(['compact', 'comfortable', 'spacious']).optional(),
    extra: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.UpdateWorkspaceClickAppsSchema = zod_1.z.object({
    sprintsEnabled: zod_1.z.boolean().optional(),
    timeTrackingEnabled: zod_1.z.boolean().optional(),
    prioritiesEnabled: zod_1.z.boolean().optional(),
    tagsEnabled: zod_1.z.boolean().optional(),
    customFieldsEnabled: zod_1.z.boolean().optional(),
    automationsEnabled: zod_1.z.boolean().optional(),
    goalsEnabled: zod_1.z.boolean().optional(),
    aiEnabled: zod_1.z.boolean().optional(),
    milestonesEnabled: zod_1.z.boolean().optional(),
    mindMapsEnabled: zod_1.z.boolean().optional(),
    whiteboardsEnabled: zod_1.z.boolean().optional(),
    portfoliosEnabled: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=preferences.schema.js.map