import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateTaskFormSchema, UpdateTaskFormSchema, SubmitFormSchema } from '@clickup/contracts';
import { randomUUID } from 'crypto';
function toFormDto(row) {
    return {
        id: row.id,
        listId: row.list_id,
        name: row.name,
        description: row.description,
        fields: row.fields,
        fieldConditions: row.field_conditions,
        isActive: row.is_active,
        slug: row.slug,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) + '-' + Math.random().toString(36).slice(2, 7);
}
// Mounted at /lists/:listId/forms (mergeParams: true)
export function formsRouter(db) {
    const router = Router({ mergeParams: true });
    // GET /lists/:listId/forms
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { listId } = req.params;
        const { rows } = await db.query('SELECT * FROM task_forms WHERE list_id = $1 ORDER BY created_at DESC', [listId]);
        res.json({ data: rows.map(toFormDto) });
    }));
    // POST /lists/:listId/forms — create form
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { listId } = req.params;
        const input = validate(CreateTaskFormSchema, req.body);
        const slug = input.slug ?? generateSlug(input.name);
        const fieldConditions = input.fieldConditions ?? null;
        try {
            const { rows } = await db.query('INSERT INTO task_forms (list_id, name, description, fields, field_conditions, slug, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [listId, input.name, input.description ?? null, JSON.stringify(input.fields), fieldConditions ? JSON.stringify(fieldConditions) : null, slug, req.auth.userId]);
            res.status(201).json({ data: toFormDto(rows[0]) });
        }
        catch (err) {
            if (err.code === '23505')
                throw new AppError(ErrorCode.TASK_FORM_SLUG_TAKEN);
            throw err;
        }
    }));
    return router;
}
// Standalone form routes — mounted at /forms
export function standaloneFormsRouter(db) {
    const router = Router();
    // GET /forms/:formId
    router.get('/:formId', requireAuth, asyncHandler(async (req, res) => {
        const { formId } = req.params;
        const { rows } = await db.query('SELECT * FROM task_forms WHERE id = $1', [formId]);
        if (!rows.length)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        res.json({ data: toFormDto(rows[0]) });
    }));
    // PATCH /forms/:formId
    router.patch('/:formId', requireAuth, asyncHandler(async (req, res) => {
        const { formId } = req.params;
        const { rows: existing } = await db.query('SELECT * FROM task_forms WHERE id = $1', [formId]);
        if (!existing.length)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        const input = validate(UpdateTaskFormSchema, req.body);
        const updates = {};
        if (input.name !== undefined)
            updates['name'] = input.name;
        if (input.description !== undefined)
            updates['description'] = input.description;
        if (input.fields !== undefined)
            updates['fields'] = JSON.stringify(input.fields);
        if (input.isActive !== undefined)
            updates['is_active'] = input.isActive;
        if (input.fieldConditions !== undefined)
            updates['field_conditions'] = JSON.stringify(input.fieldConditions);
        const fields = Object.keys(updates);
        if (!fields.length) {
            res.json({ data: toFormDto(existing[0]) });
            return;
        }
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const { rows } = await db.query(`UPDATE task_forms SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`, [formId, ...Object.values(updates)]);
        res.json({ data: toFormDto(rows[0]) });
    }));
    // DELETE /forms/:formId
    router.delete('/:formId', requireAuth, asyncHandler(async (req, res) => {
        const { formId } = req.params;
        const { rowCount } = await db.query('DELETE FROM task_forms WHERE id = $1', [formId]);
        if (!rowCount)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        res.status(204).end();
    }));
    // POST /forms/submit/:slug — public form submission (no auth)
    router.post('/submit/:slug', asyncHandler(async (req, res) => {
        const { slug } = req.params;
        const { rows } = await db.query('SELECT * FROM task_forms WHERE slug = $1', [slug]);
        if (!rows.length)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        const form = rows[0];
        if (!form.is_active)
            throw new AppError(ErrorCode.TASK_FORM_INACTIVE);
        const input = validate(SubmitFormSchema, req.body);
        // Map form submission data to task fields
        const taskTitle = input.data['title'] ?? 'New Submission';
        const taskDescription = input.data['description'];
        const taskId = randomUUID();
        const path = taskId;
        const { rows: taskRows } = await db.query(`INSERT INTO tasks (id, list_id, path, title, description, created_by, version)
       VALUES ($1,$2,$3,$4,$5,NULL,0) RETURNING id`, [taskId, form.list_id, path, taskTitle, taskDescription ?? null]);
        // Record the submission
        await db.query('INSERT INTO form_submissions (form_id, task_id, data) VALUES ($1,$2,$3)', [form.id, taskRows[0].id, JSON.stringify(input.data)]);
        res.status(201).json({ data: { submissionId: taskId, taskId: taskRows[0].id } });
    }));
    // POST /forms/:formId/validate-conditions — evaluate field conditions
    router.post('/:formId/validate-conditions', asyncHandler(async (req, res) => {
        const { formId } = req.params;
        const { rows } = await db.query('SELECT * FROM task_forms WHERE id = $1', [formId]);
        if (!rows.length)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        const form = rows[0];
        const { fieldValues } = req.body;
        if (!fieldValues || typeof fieldValues !== 'object') {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'fieldValues is required and must be an object');
        }
        const conditions = form.field_conditions;
        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
            // No conditions — all fields visible
            res.json({ data: { visibleFields: Object.keys(fieldValues) } });
            return;
        }
        const visibleFields = new Set();
        // Start with all form field names as visible
        const formFields = form.fields;
        if (formFields && Array.isArray(formFields)) {
            for (const f of formFields) {
                if (f.name)
                    visibleFields.add(f.name);
            }
        }
        // Evaluate conditions
        for (const condition of conditions) {
            const { fieldName, operator, value, showFields } = condition;
            const fieldValue = fieldValues[fieldName];
            let conditionMet = false;
            switch (operator) {
                case 'equals':
                    conditionMet = fieldValue === value;
                    break;
                case 'not_equals':
                    conditionMet = fieldValue !== value;
                    break;
                case 'contains':
                    conditionMet = typeof fieldValue === 'string' && fieldValue.includes(value);
                    break;
                case 'greater_than':
                    conditionMet = typeof fieldValue === 'number' && fieldValue > value;
                    break;
                case 'less_than':
                    conditionMet = typeof fieldValue === 'number' && fieldValue < value;
                    break;
                case 'is_set':
                    conditionMet = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
                    break;
                case 'is_not_set':
                    conditionMet = fieldValue === null || fieldValue === undefined || fieldValue === '';
                    break;
                default:
                    conditionMet = false;
            }
            if (!conditionMet && showFields && Array.isArray(showFields)) {
                // Hide fields that are conditionally shown
                for (const sf of showFields) {
                    visibleFields.delete(sf);
                }
            }
        }
        res.json({ data: { visibleFields: Array.from(visibleFields) } });
    }));
    // GET /forms/:formId/submissions — view submissions (auth required)
    router.get('/:formId/submissions', requireAuth, asyncHandler(async (req, res) => {
        const { formId } = req.params;
        const { rows: formRows } = await db.query('SELECT id FROM task_forms WHERE id = $1', [formId]);
        if (!formRows.length)
            throw new AppError(ErrorCode.TASK_FORM_NOT_FOUND);
        const { rows } = await db.query('SELECT * FROM form_submissions WHERE form_id = $1 ORDER BY submitted_at DESC', [formId]);
        res.json({ data: rows });
    }));
    return router;
}
//# sourceMappingURL=forms.handler.js.map