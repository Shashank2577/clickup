"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitFormResponseSchema = exports.UpdateFormSchema = exports.CreateFormSchema = exports.SubmitFormSchema = exports.UpdateTaskFormSchema = exports.CreateTaskFormSchema = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
const FormFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: zod_1.z.enum(['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'email', 'url', 'checkbox']),
    label: zod_1.z.string().min(1).max(200),
    required: zod_1.z.boolean().optional().default(false),
    placeholder: zod_1.z.string().max(200).optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    taskField: zod_1.z.enum(['title', 'description', 'priority', 'due_date', 'assignee_id', 'tags', 'custom']).optional(),
    customFieldId: uuid.optional(),
});
exports.CreateTaskFormSchema = zod_1.z.object({
    listId: uuid,
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(2000).optional(),
    fields: zod_1.z.array(FormFieldSchema).min(1).max(50),
    slug: zod_1.z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
});
exports.UpdateTaskFormSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(2000).optional(),
    fields: zod_1.z.array(FormFieldSchema).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.SubmitFormSchema = zod_1.z.object({
    data: zod_1.z.record(zod_1.z.unknown()),
});
// ============================================================
// Form-service schemas (richer form model)
// ============================================================
const FormServiceFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: zod_1.z.enum([
        'text', 'number', 'dropdown', 'checkbox', 'date',
        'email', 'phone', 'url', 'rating', 'file_upload',
    ]),
    label: zod_1.z.string().min(1).max(200),
    required: zod_1.z.boolean().optional().default(false),
    placeholder: zod_1.z.string().max(200).optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().max(500).optional(),
    taskField: zod_1.z.enum(['title', 'description', 'priority', 'due_date', 'assignee_id', 'tags', 'custom']).optional(),
    customFieldId: uuid.optional(),
    validation: zod_1.z.object({
        min: zod_1.z.number().optional(),
        max: zod_1.z.number().optional(),
        pattern: zod_1.z.string().optional(),
    }).optional(),
});
exports.CreateFormSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(2000).optional(),
    listId: uuid,
    fields: zod_1.z.array(FormServiceFieldSchema).min(1).max(50),
});
exports.UpdateFormSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(2000).optional(),
    fields: zod_1.z.array(FormServiceFieldSchema).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.SubmitFormResponseSchema = zod_1.z.object({
    data: zod_1.z.record(zod_1.z.unknown()),
    submittedBy: zod_1.z.string().max(200).optional(),
});
//# sourceMappingURL=form.schema.js.map