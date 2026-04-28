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
        table: z.ZodOptional<z.ZodObject<{
            inlineEditing: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            rowHeight: z.ZodDefault<z.ZodOptional<z.ZodEnum<["compact", "normal", "tall"]>>>;
            frozenColumns: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        }, {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        }>>;
        timeline: z.ZodOptional<z.ZodObject<{
            startField: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            endField: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            zoom: z.ZodDefault<z.ZodOptional<z.ZodEnum<["day", "week", "month", "quarter"]>>>;
        }, "strip", z.ZodTypeAny, {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        }, {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        }>>;
        workload: z.ZodOptional<z.ZodObject<{
            capacityField: z.ZodDefault<z.ZodOptional<z.ZodEnum<["hours", "points"]>>>;
            maxCapacity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            showOverallocated: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        }, {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        }>>;
        team: z.ZodOptional<z.ZodObject<{
            groupByUser: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showAvatar: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showTaskCount: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        }, {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        }>>;
        activity: z.ZodOptional<z.ZodObject<{
            showSystem: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            showSystem: boolean;
            limit: number;
        }, {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        }>>;
        map: z.ZodOptional<z.ZodObject<{
            locationFieldId: z.ZodOptional<z.ZodString>;
            defaultZoom: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            defaultCenter: z.ZodOptional<z.ZodObject<{
                lat: z.ZodNumber;
                lng: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                lat: number;
                lng: number;
            }, {
                lat: number;
                lng: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        }, {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        }>>;
        mindmap: z.ZodOptional<z.ZodObject<{
            rootTaskId: z.ZodOptional<z.ZodString>;
            layout: z.ZodDefault<z.ZodOptional<z.ZodEnum<["tree", "radial"]>>>;
        }, "strip", z.ZodTypeAny, {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        }, {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        }>>;
        embed: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            embedType: z.ZodDefault<z.ZodOptional<z.ZodEnum<["website", "google_sheets", "figma", "miro", "youtube", "other"]>>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        }, {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        }>>;
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
        timeline?: {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        } | undefined;
        table?: {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        } | undefined;
        workload?: {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        } | undefined;
        activity?: {
            showSystem: boolean;
            limit: number;
        } | undefined;
        team?: {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        } | undefined;
        map?: {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    }, {
        timeline?: {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        } | undefined;
        table?: {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        } | undefined;
        workload?: {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        } | undefined;
        activity?: {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        } | undefined;
        team?: {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        } | undefined;
        map?: {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        } | undefined;
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
        timeline?: {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        } | undefined;
        table?: {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        } | undefined;
        workload?: {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        } | undefined;
        activity?: {
            showSystem: boolean;
            limit: number;
        } | undefined;
        team?: {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        } | undefined;
        map?: {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    };
    isPrivate: boolean;
    listId?: string | undefined;
}, {
    name: string;
    type?: ViewType | undefined;
    config?: {
        timeline?: {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        } | undefined;
        table?: {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        } | undefined;
        workload?: {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        } | undefined;
        activity?: {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        } | undefined;
        team?: {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        } | undefined;
        map?: {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        } | undefined;
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
        table: z.ZodOptional<z.ZodObject<{
            inlineEditing: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            rowHeight: z.ZodDefault<z.ZodOptional<z.ZodEnum<["compact", "normal", "tall"]>>>;
            frozenColumns: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        }, {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        }>>;
        timeline: z.ZodOptional<z.ZodObject<{
            startField: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            endField: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            zoom: z.ZodDefault<z.ZodOptional<z.ZodEnum<["day", "week", "month", "quarter"]>>>;
        }, "strip", z.ZodTypeAny, {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        }, {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        }>>;
        workload: z.ZodOptional<z.ZodObject<{
            capacityField: z.ZodDefault<z.ZodOptional<z.ZodEnum<["hours", "points"]>>>;
            maxCapacity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            showOverallocated: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        }, {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        }>>;
        team: z.ZodOptional<z.ZodObject<{
            groupByUser: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showAvatar: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showTaskCount: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        }, {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        }>>;
        activity: z.ZodOptional<z.ZodObject<{
            showSystem: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            showSystem: boolean;
            limit: number;
        }, {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        }>>;
        map: z.ZodOptional<z.ZodObject<{
            locationFieldId: z.ZodOptional<z.ZodString>;
            defaultZoom: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            defaultCenter: z.ZodOptional<z.ZodObject<{
                lat: z.ZodNumber;
                lng: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                lat: number;
                lng: number;
            }, {
                lat: number;
                lng: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        }, {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        }>>;
        mindmap: z.ZodOptional<z.ZodObject<{
            rootTaskId: z.ZodOptional<z.ZodString>;
            layout: z.ZodDefault<z.ZodOptional<z.ZodEnum<["tree", "radial"]>>>;
        }, "strip", z.ZodTypeAny, {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        }, {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        }>>;
        embed: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            embedType: z.ZodDefault<z.ZodOptional<z.ZodEnum<["website", "google_sheets", "figma", "miro", "youtube", "other"]>>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        }, {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        }>>;
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
        timeline?: {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        } | undefined;
        table?: {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        } | undefined;
        workload?: {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        } | undefined;
        activity?: {
            showSystem: boolean;
            limit: number;
        } | undefined;
        team?: {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        } | undefined;
        map?: {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    }, {
        timeline?: {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        } | undefined;
        table?: {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        } | undefined;
        workload?: {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        } | undefined;
        activity?: {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        } | undefined;
        team?: {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        } | undefined;
        map?: {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        } | undefined;
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
        timeline?: {
            startField: string;
            endField: string;
            zoom: "day" | "week" | "month" | "quarter";
        } | undefined;
        table?: {
            inlineEditing: boolean;
            rowHeight: "normal" | "compact" | "tall";
            frozenColumns: number;
        } | undefined;
        workload?: {
            capacityField: "hours" | "points";
            maxCapacity: number;
            showOverallocated: boolean;
        } | undefined;
        activity?: {
            showSystem: boolean;
            limit: number;
        } | undefined;
        team?: {
            groupByUser: boolean;
            showAvatar: boolean;
            showTaskCount: boolean;
        } | undefined;
        map?: {
            defaultZoom: number;
            locationFieldId?: string | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            layout: "tree" | "radial";
            rootTaskId?: string | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube";
            height: number;
        } | undefined;
        groupById?: string | undefined;
        datePropertyId?: string | undefined;
    } | undefined;
    isPrivate?: boolean | undefined;
}, {
    name?: string | undefined;
    config?: {
        timeline?: {
            startField?: string | undefined;
            endField?: string | undefined;
            zoom?: "day" | "week" | "month" | "quarter" | undefined;
        } | undefined;
        table?: {
            inlineEditing?: boolean | undefined;
            rowHeight?: "normal" | "compact" | "tall" | undefined;
            frozenColumns?: number | undefined;
        } | undefined;
        workload?: {
            capacityField?: "hours" | "points" | undefined;
            maxCapacity?: number | undefined;
            showOverallocated?: boolean | undefined;
        } | undefined;
        activity?: {
            showSystem?: boolean | undefined;
            limit?: number | undefined;
        } | undefined;
        team?: {
            groupByUser?: boolean | undefined;
            showAvatar?: boolean | undefined;
            showTaskCount?: boolean | undefined;
        } | undefined;
        map?: {
            locationFieldId?: string | undefined;
            defaultZoom?: number | undefined;
            defaultCenter?: {
                lat: number;
                lng: number;
            } | undefined;
        } | undefined;
        mindmap?: {
            rootTaskId?: string | undefined;
            layout?: "tree" | "radial" | undefined;
        } | undefined;
        embed?: {
            url: string;
            embedType?: "other" | "website" | "google_sheets" | "figma" | "miro" | "youtube" | undefined;
            height?: number | undefined;
        } | undefined;
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
export declare const UpdateViewSharingSchema: z.ZodObject<{
    visibility: z.ZodEnum<["private", "shared"]>;
    pinned: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    visibility: "private" | "shared";
    pinned?: boolean | undefined;
}, {
    visibility: "private" | "shared";
    pinned?: boolean | undefined;
}>;
export type CreateViewInput = z.infer<typeof CreateViewSchema>;
export type UpdateViewInput = z.infer<typeof UpdateViewSchema>;
export type UpdateViewSharingInput = z.infer<typeof UpdateViewSharingSchema>;
export type CreateTaskStatusInput = z.infer<typeof CreateTaskStatusSchema>;
export {};
//# sourceMappingURL=view.schema.d.ts.map