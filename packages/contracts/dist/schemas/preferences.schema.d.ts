import { z } from 'zod';
export declare const UpdateUserPreferencesSchema: z.ZodObject<{
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    language: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    dateFormat: z.ZodOptional<z.ZodString>;
    timeFormat: z.ZodOptional<z.ZodEnum<["12h", "24h"]>>;
    firstDayOfWeek: z.ZodOptional<z.ZodNumber>;
    sidebarCollapsed: z.ZodOptional<z.ZodBoolean>;
    density: z.ZodOptional<z.ZodEnum<["compact", "comfortable", "spacious"]>>;
    extra: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    timezone?: string | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    language?: string | undefined;
    dateFormat?: string | undefined;
    timeFormat?: "12h" | "24h" | undefined;
    firstDayOfWeek?: number | undefined;
    sidebarCollapsed?: boolean | undefined;
    density?: "compact" | "comfortable" | "spacious" | undefined;
    extra?: Record<string, unknown> | undefined;
}, {
    timezone?: string | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    language?: string | undefined;
    dateFormat?: string | undefined;
    timeFormat?: "12h" | "24h" | undefined;
    firstDayOfWeek?: number | undefined;
    sidebarCollapsed?: boolean | undefined;
    density?: "compact" | "comfortable" | "spacious" | undefined;
    extra?: Record<string, unknown> | undefined;
}>;
export declare const UpdateWorkspaceClickAppsSchema: z.ZodObject<{
    sprintsEnabled: z.ZodOptional<z.ZodBoolean>;
    timeTrackingEnabled: z.ZodOptional<z.ZodBoolean>;
    prioritiesEnabled: z.ZodOptional<z.ZodBoolean>;
    tagsEnabled: z.ZodOptional<z.ZodBoolean>;
    customFieldsEnabled: z.ZodOptional<z.ZodBoolean>;
    automationsEnabled: z.ZodOptional<z.ZodBoolean>;
    goalsEnabled: z.ZodOptional<z.ZodBoolean>;
    aiEnabled: z.ZodOptional<z.ZodBoolean>;
    milestonesEnabled: z.ZodOptional<z.ZodBoolean>;
    mindMapsEnabled: z.ZodOptional<z.ZodBoolean>;
    whiteboardsEnabled: z.ZodOptional<z.ZodBoolean>;
    portfoliosEnabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sprintsEnabled?: boolean | undefined;
    timeTrackingEnabled?: boolean | undefined;
    prioritiesEnabled?: boolean | undefined;
    tagsEnabled?: boolean | undefined;
    customFieldsEnabled?: boolean | undefined;
    automationsEnabled?: boolean | undefined;
    goalsEnabled?: boolean | undefined;
    aiEnabled?: boolean | undefined;
    milestonesEnabled?: boolean | undefined;
    mindMapsEnabled?: boolean | undefined;
    whiteboardsEnabled?: boolean | undefined;
    portfoliosEnabled?: boolean | undefined;
}, {
    sprintsEnabled?: boolean | undefined;
    timeTrackingEnabled?: boolean | undefined;
    prioritiesEnabled?: boolean | undefined;
    tagsEnabled?: boolean | undefined;
    customFieldsEnabled?: boolean | undefined;
    automationsEnabled?: boolean | undefined;
    goalsEnabled?: boolean | undefined;
    aiEnabled?: boolean | undefined;
    milestonesEnabled?: boolean | undefined;
    mindMapsEnabled?: boolean | undefined;
    whiteboardsEnabled?: boolean | undefined;
    portfoliosEnabled?: boolean | undefined;
}>;
//# sourceMappingURL=preferences.schema.d.ts.map