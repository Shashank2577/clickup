import { z } from 'zod';
export declare const CreateTaskTemplateSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    templateData: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        priority: z.ZodOptional<z.ZodString>;
        estimatedMinutes: z.ZodOptional<z.ZodNumber>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        checklists: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            items: z.ZodArray<z.ZodObject<{
                title: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                title: string;
            }, {
                title: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            title: string;
            items: {
                title: string;
            }[];
        }, {
            title: string;
            items: {
                title: string;
            }[];
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description?: string | undefined;
        priority?: string | undefined;
        estimatedMinutes?: number | undefined;
        tags?: string[] | undefined;
        checklists?: {
            title: string;
            items: {
                title: string;
            }[];
        }[] | undefined;
    }, {
        title: string;
        description?: string | undefined;
        priority?: string | undefined;
        estimatedMinutes?: number | undefined;
        tags?: string[] | undefined;
        checklists?: {
            title: string;
            items: {
                title: string;
            }[];
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    workspaceId: string;
    templateData: {
        title: string;
        description?: string | undefined;
        priority?: string | undefined;
        estimatedMinutes?: number | undefined;
        tags?: string[] | undefined;
        checklists?: {
            title: string;
            items: {
                title: string;
            }[];
        }[] | undefined;
    };
    description?: string | undefined;
}, {
    name: string;
    workspaceId: string;
    templateData: {
        title: string;
        description?: string | undefined;
        priority?: string | undefined;
        estimatedMinutes?: number | undefined;
        tags?: string[] | undefined;
        checklists?: {
            title: string;
            items: {
                title: string;
            }[];
        }[] | undefined;
    };
    description?: string | undefined;
}>;
export declare const UpdateTaskTemplateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    templateData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    templateData?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    templateData?: Record<string, unknown> | undefined;
}>;
export type CreateTaskTemplateInput = z.infer<typeof CreateTaskTemplateSchema>;
export type UpdateTaskTemplateInput = z.infer<typeof UpdateTaskTemplateSchema>;
//# sourceMappingURL=template.schema.d.ts.map