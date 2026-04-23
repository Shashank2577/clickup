import { z } from 'zod';
export declare const CreateTaskFormSchema: z.ZodObject<{
    listId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["text", "textarea", "select", "multiselect", "date", "number", "email", "url", "checkbox"]>;
        label: z.ZodString;
        required: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        placeholder: z.ZodOptional<z.ZodString>;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        taskField: z.ZodOptional<z.ZodEnum<["title", "description", "priority", "due_date", "assignee_id", "tags", "custom"]>>;
        customFieldId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        required: boolean;
        options?: string[] | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }, {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        options?: string[] | undefined;
        required?: boolean | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }>, "many">;
    slug: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    listId: string;
    fields: {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        required: boolean;
        options?: string[] | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }[];
    description?: string | undefined;
    slug?: string | undefined;
}, {
    name: string;
    listId: string;
    fields: {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        options?: string[] | undefined;
        required?: boolean | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }[];
    description?: string | undefined;
    slug?: string | undefined;
}>;
export declare const UpdateTaskFormSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["text", "textarea", "select", "multiselect", "date", "number", "email", "url", "checkbox"]>;
        label: z.ZodString;
        required: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        placeholder: z.ZodOptional<z.ZodString>;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        taskField: z.ZodOptional<z.ZodEnum<["title", "description", "priority", "due_date", "assignee_id", "tags", "custom"]>>;
        customFieldId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        required: boolean;
        options?: string[] | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }, {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        options?: string[] | undefined;
        required?: boolean | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }>, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    isActive?: boolean | undefined;
    fields?: {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        required: boolean;
        options?: string[] | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }[] | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    isActive?: boolean | undefined;
    fields?: {
        id: string;
        type: "number" | "text" | "date" | "checkbox" | "url" | "email" | "textarea" | "select" | "multiselect";
        label: string;
        options?: string[] | undefined;
        required?: boolean | undefined;
        placeholder?: string | undefined;
        taskField?: "title" | "description" | "priority" | "tags" | "custom" | "due_date" | "assignee_id" | undefined;
        customFieldId?: string | undefined;
    }[] | undefined;
}>;
export declare const SubmitFormSchema: z.ZodObject<{
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    data: Record<string, unknown>;
}, {
    data: Record<string, unknown>;
}>;
export type CreateTaskFormInput = z.infer<typeof CreateTaskFormSchema>;
export type UpdateTaskFormInput = z.infer<typeof UpdateTaskFormSchema>;
export type SubmitFormInput = z.infer<typeof SubmitFormSchema>;
//# sourceMappingURL=form.schema.d.ts.map