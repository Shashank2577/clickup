import { z } from 'zod';
import { ViewType, FilterCondition } from '../types/enums.js';
declare const FilterClauseSchema: z.ZodObject<{
    propertyId: z.ZodString;
    condition: z.ZodNativeEnum<typeof FilterCondition>;
    values: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    values: string[];
    propertyId: string;
    condition: FilterCondition;
}, {
    values: string[];
    propertyId: string;
    condition: FilterCondition;
}>;
export declare const CreateViewSchema: z.ZodObject<{
    listId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    type: z.ZodDefault<z.ZodNativeEnum<typeof ViewType>>;
    config: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        groupById: z.ZodOptional<z.ZodString>;
        datePropertyId: z.ZodOptional<z.ZodString>;
        sortOptions: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            direction: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            propertyId: string;
            direction: "asc" | "desc";
        }, {
            propertyId: string;
            direction: "asc" | "desc";
        }>, "many">>>;
        visiblePropertyIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        filter: z.ZodDefault<z.ZodOptional<z.ZodType<{
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        }, z.ZodTypeDef, {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        }>>>;
        columnWidths: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        collapsedGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        filter: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        };
        sortOptions: {
            propertyId: string;
            direction: "asc" | "desc";
        }[];
        visiblePropertyIds: string[];
        columnWidths: Record<string, number>;
        collapsedGroups: string[];
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    }, {
        filter?: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
        sortOptions?: {
            propertyId: string;
            direction: "asc" | "desc";
        }[] | undefined;
        visiblePropertyIds?: string[] | undefined;
        columnWidths?: Record<string, number> | undefined;
        collapsedGroups?: string[] | undefined;
    }>>>;
    isPrivate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: ViewType;
    config: {
        filter: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        };
        sortOptions: {
            propertyId: string;
            direction: "asc" | "desc";
        }[];
        visiblePropertyIds: string[];
        columnWidths: Record<string, number>;
        collapsedGroups: string[];
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    };
    isPrivate: boolean;
    listId?: string | undefined;
}, {
    name: string;
    type?: ViewType | undefined;
    config?: {
        filter?: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
        sortOptions?: {
            propertyId: string;
            direction: "asc" | "desc";
        }[] | undefined;
        visiblePropertyIds?: string[] | undefined;
        columnWidths?: Record<string, number> | undefined;
        collapsedGroups?: string[] | undefined;
    } | undefined;
    listId?: string | undefined;
    isPrivate?: boolean | undefined;
}>;
export declare const UpdateViewSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        groupById: z.ZodOptional<z.ZodString>;
        datePropertyId: z.ZodOptional<z.ZodString>;
        sortOptions: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            direction: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            propertyId: string;
            direction: "asc" | "desc";
        }, {
            propertyId: string;
            direction: "asc" | "desc";
        }>, "many">>>;
        visiblePropertyIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        filter: z.ZodDefault<z.ZodOptional<z.ZodType<{
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        }, z.ZodTypeDef, {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        }>>>;
        columnWidths: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        collapsedGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        filter: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        };
        sortOptions: {
            propertyId: string;
            direction: "asc" | "desc";
        }[];
        visiblePropertyIds: string[];
        columnWidths: Record<string, number>;
        collapsedGroups: string[];
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    }, {
        filter?: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
        sortOptions?: {
            propertyId: string;
            direction: "asc" | "desc";
        }[] | undefined;
        visiblePropertyIds?: string[] | undefined;
        columnWidths?: Record<string, number> | undefined;
        collapsedGroups?: string[] | undefined;
    }>>;
    isPrivate: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    config?: {
        filter: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        };
        sortOptions: {
            propertyId: string;
            direction: "asc" | "desc";
        }[];
        visiblePropertyIds: string[];
        columnWidths: Record<string, number>;
        collapsedGroups: string[];
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    } | undefined;
    isPrivate?: boolean | undefined;
}, {
    name?: string | undefined;
    config?: {
        filter?: {
            operation: "and" | "or";
            filters: Array<z.infer<typeof FilterClauseSchema> | {
                operation: "and" | "or";
                filters: unknown[];
            }>;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
        sortOptions?: {
            propertyId: string;
            direction: "asc" | "desc";
        }[] | undefined;
        visiblePropertyIds?: string[] | undefined;
        columnWidths?: Record<string, number> | undefined;
        collapsedGroups?: string[] | undefined;
    } | undefined;
    isPrivate?: boolean | undefined;
}>;
export declare const UpdateViewUserStateSchema: z.ZodObject<{
    collapsedGroups: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    collapsedGroups?: string[] | undefined;
    hiddenColumns?: string[] | undefined;
}, {
    collapsedGroups?: string[] | undefined;
    hiddenColumns?: string[] | undefined;
}>;
export declare const CreateTaskStatusSchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    group: z.ZodDefault<z.ZodOptional<z.ZodEnum<["backlog", "unstarted", "started", "completed", "cancelled"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    color: string;
    group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
}, {
    name: string;
    color?: string | undefined;
    group?: "backlog" | "unstarted" | "started" | "completed" | "cancelled" | undefined;
}>;
export declare const UpdateTaskStatusSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    group: z.ZodOptional<z.ZodEnum<["backlog", "unstarted", "started", "completed", "cancelled"]>>;
    position: z.ZodOptional<z.ZodNumber>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    position?: number | undefined;
    color?: string | undefined;
    group?: "backlog" | "unstarted" | "started" | "completed" | "cancelled" | undefined;
    isDefault?: boolean | undefined;
}, {
    name?: string | undefined;
    position?: number | undefined;
    color?: string | undefined;
    group?: "backlog" | "unstarted" | "started" | "completed" | "cancelled" | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateViewInput = z.infer<typeof CreateViewSchema>;
export type UpdateViewInput = z.infer<typeof UpdateViewSchema>;
export type CreateTaskStatusInput = z.infer<typeof CreateTaskStatusSchema>;
export {};
//# sourceMappingURL=view.schema.d.ts.map