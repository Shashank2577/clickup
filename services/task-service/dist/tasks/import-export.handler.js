import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
async function readMultipart(req) {
    const contentType = req.headers['content-type'] ?? '';
    const boundaryMatch = /boundary=([^\s;]+)/.exec(contentType);
    if (!boundaryMatch) {
        throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Expected multipart/form-data with boundary');
    }
    const boundary = '--' + boundaryMatch[1];
    const chunks = [];
    await new Promise((resolve, reject) => {
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', resolve);
        req.on('error', reject);
    });
    const body = Buffer.concat(chunks).toString('latin1');
    const parts = body.split(boundary).slice(1); // skip preamble
    const fields = {};
    let file;
    let filename;
    for (const part of parts) {
        if (part.trim() === '--' || part.trim() === '--\r\n')
            break;
        const [headerSection, ...contentParts] = part.split('\r\n\r\n');
        const content = contentParts.join('\r\n\r\n').replace(/\r\n--$/, '');
        const nameMatch = /name="([^"]+)"/.exec(headerSection ?? '');
        const filenameMatch = /filename="([^"]+)"/.exec(headerSection ?? '');
        if (!nameMatch)
            continue;
        const fieldName = nameMatch[1];
        if (filenameMatch) {
            filename = filenameMatch[1];
            file = content;
        }
        else {
            fields[fieldName] = content.trim();
        }
    }
    const result = { fields };
    if (file !== undefined)
        result["file"] = file;
    if (filename !== undefined)
        result["filename"] = filename;
    return result;
}
// ============================================================
// Simple CSV parser — no dependencies
// Handles quoted fields and escaped quotes.
// ============================================================
function parseCsv(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return { headers: [], rows: [] };
    const headers = parseCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] ?? '';
        }
        rows.push(row);
    }
    return { headers, rows };
}
function parseCsvLine(line) {
    const fields = [];
    let i = 0;
    while (i < line.length) {
        if (line[i] === '"') {
            // Quoted field
            i++; // skip opening quote
            let value = '';
            while (i < line.length) {
                if (line[i] === '"') {
                    if (line[i + 1] === '"') {
                        value += '"';
                        i += 2;
                    }
                    else {
                        i++; // skip closing quote
                        break;
                    }
                }
                else {
                    value += line[i];
                    i++;
                }
            }
            fields.push(value);
            if (line[i] === ',')
                i++; // skip comma
        }
        else {
            // Unquoted field
            const end = line.indexOf(',', i);
            if (end === -1) {
                fields.push(line.slice(i));
                break;
            }
            fields.push(line.slice(i, end));
            i = end + 1;
        }
    }
    return fields;
}
// ============================================================
// CSV serialiser helper
// ============================================================
function escapeCsvField(value) {
    if (value === null || value === undefined)
        return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}
function rowToCsvLine(fields) {
    return fields.map(escapeCsvField).join(',');
}
// ============================================================
// Handler factory
// ============================================================
export function importExportRouter(db) {
    const router = Router();
    const repository = new TasksRepository(db);
    // ── CSV Import ──────────────────────────────────────────────────────────────
    // POST /import/csv
    // Accepts multipart/form-data: CSV file + listId field
    router.post('/import/csv', requireAuth, asyncHandler(async (req, res) => {
        // Parse multipart manually (no papaparse / formidable needed)
        const { fields, file } = await readMultipart(req);
        const listId = fields['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId field is required');
        if (!file)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'CSV file is required');
        // Verify list exists and get workspace context
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        // Verify membership
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const { rows } = parseCsv(file);
        let imported = 0;
        const errors = [];
        const basePath = '/' + listId + '/';
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-indexed, +1 for header row
            const title = row['title']?.trim();
            if (!title) {
                errors.push({ row: rowNum, message: 'title is required' });
                continue;
            }
            try {
                const taskId = randomUUID();
                const path = basePath + taskId + '/';
                // Map priority to valid values
                const rawPriority = row['priority']?.toLowerCase();
                const priority = ['urgent', 'high', 'normal', 'low', 'none'].includes(rawPriority ?? '')
                    ? rawPriority
                    : 'none';
                // Map status
                const status = row['status']?.trim() || 'todo';
                const assigneeId = row['assignee_id']?.trim() || undefined;
                const createArgs = {
                    id: taskId,
                    listId,
                    title,
                    parentId: null,
                    path,
                    createdBy: req.auth.userId,
                    priority: priority,
                };
                if (assigneeId)
                    createArgs.assigneeId = assigneeId;
                await repository.createTask(createArgs);
                // Set description via update if provided
                if (row['description']?.trim()) {
                    await repository.updateTask(taskId, { description: row['description'].trim() });
                }
                // Set status if provided
                if (status && status !== 'todo') {
                    await repository.updateTask(taskId, { status });
                }
                // Set due_date if provided
                if (row['due_date']?.trim()) {
                    await repository.updateTask(taskId, { due_date: row['due_date'].trim() });
                }
                // Set tags if provided
                if (row['tags']?.trim()) {
                    const tags = row['tags'].split(',').map((t) => t.trim()).filter(Boolean);
                    for (const tag of tags) {
                        await repository.addTag(taskId, tag);
                    }
                }
                imported++;
            }
            catch (err) {
                errors.push({ row: rowNum, message: err?.message ?? 'unknown error' });
            }
        }
        res.json({ imported, errors });
    }));
    // ── CSV Export ──────────────────────────────────────────────────────────────
    // GET /export/csv?listId=uuid
    router.get('/export/csv', requireAuth, asyncHandler(async (req, res) => {
        const listId = req.query['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId query param is required');
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        // Fetch all non-deleted tasks in list
        const taskRows = await db.query(`SELECT id, title, description, status, priority, assignee_id, due_date, created_at
         FROM tasks
         WHERE list_id = $1 AND deleted_at IS NULL
         ORDER BY position ASC`, [listId]);
        const CSV_HEADERS = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date', 'created_at', 'tags'];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
        // Write header row
        res.write(CSV_HEADERS.join(',') + '\n');
        // Write data rows
        for (const task of taskRows.rows) {
            // Get tags for task
            const tagRows = await repository.getTags(task.id);
            const tagsStr = tagRows.join(',');
            const line = rowToCsvLine([
                task.title,
                task.description ?? '',
                task.status,
                task.priority,
                task.assignee_id ?? '',
                task.due_date ?? '',
                task.created_at.toISOString(),
                tagsStr,
            ]);
            res.write(line + '\n');
        }
        res.end();
    }));
    // ── JSON Export ─────────────────────────────────────────────────────────────
    // GET /export/json?listId=uuid
    router.get('/export/json', requireAuth, asyncHandler(async (req, res) => {
        const listId = req.query['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId query param is required');
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        // Full task data
        const taskRows = await db.query(`SELECT t.*, array_agg(tt.tag) FILTER (WHERE tt.tag IS NOT NULL) AS tags
         FROM tasks t
         LEFT JOIN task_tags tt ON tt.task_id = t.id
         WHERE t.list_id = $1 AND t.deleted_at IS NULL
         GROUP BY t.id
         ORDER BY t.position ASC`, [listId]);
        res.json({ data: taskRows.rows });
    }));
    // ── Jira JSON Import ────────────────────────────────────────────────────────
    // POST /import/jira
    // Accepts multipart/form-data: Jira JSON export file + listId field
    router.post('/import/jira', requireAuth, asyncHandler(async (req, res) => {
        const { fields, file } = await readMultipart(req);
        const listId = fields['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId field is required');
        if (!file)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Jira JSON file is required');
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        let jiraData;
        try {
            jiraData = JSON.parse(file);
        }
        catch {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid JSON file');
        }
        const projects = Array.isArray(jiraData?.projects) ? jiraData.projects : [];
        const mapJiraPriority = (name) => {
            const n = name ?? '';
            if (n === 'Highest' || n === 'High')
                return 'high';
            if (n === 'Medium')
                return 'normal';
            if (n === 'Low' || n === 'Lowest')
                return 'low';
            return 'none';
        };
        let imported = 0;
        const createdTaskIds = [];
        const basePath = '/' + listId + '/';
        for (const project of projects) {
            const issues = Array.isArray(project?.issues) ? project.issues : [];
            for (const issue of issues) {
                const taskId = randomUUID();
                const path = basePath + taskId + '/';
                const title = String(issue?.summary ?? 'Untitled').trim() || 'Untitled';
                const description = issue?.description ? String(issue.description) : null;
                const priority = mapJiraPriority(issue?.priority?.name);
                const status = issue?.status?.name ? String(issue.status.name) : 'todo';
                const dueDate = issue?.dueDate ? String(issue.dueDate) : null;
                await db.query(`INSERT INTO tasks (id, list_id, title, description, status, priority, due_date, path, created_by, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`, [taskId, listId, title, description, status, priority, dueDate, path, req.auth.userId]);
                createdTaskIds.push(taskId);
                imported++;
                // Create subtasks
                const subtasks = Array.isArray(issue?.subtasks) ? issue.subtasks : [];
                for (const sub of subtasks) {
                    const subId = randomUUID();
                    const subPath = path + subId + '/';
                    const subTitle = String(sub?.summary ?? 'Untitled').trim() || 'Untitled';
                    await db.query(`INSERT INTO tasks (id, list_id, title, status, priority, path, parent_id, created_by, version)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`, [subId, listId, subTitle, 'todo', 'none', subPath, taskId, req.auth.userId]);
                    createdTaskIds.push(subId);
                    imported++;
                }
            }
        }
        res.status(201).json({ data: { imported, tasks: createdTaskIds } });
    }));
    // ── Trello JSON Import ──────────────────────────────────────────────────────
    // POST /import/trello
    // Accepts multipart/form-data: Trello JSON export file + listId field
    router.post('/import/trello', requireAuth, asyncHandler(async (req, res) => {
        const { fields, file } = await readMultipart(req);
        const listId = fields['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId field is required');
        if (!file)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Trello JSON file is required');
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        let trelloData;
        try {
            trelloData = JSON.parse(file);
        }
        catch {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid JSON file');
        }
        // Build a map of Trello list ID → list name for status mapping
        const trelloLists = Array.isArray(trelloData?.lists) ? trelloData.lists : [];
        const listNameById = new Map();
        for (const tl of trelloLists) {
            if (tl?.id && tl?.name) {
                listNameById.set(String(tl.id), String(tl.name));
            }
        }
        const cards = Array.isArray(trelloData?.cards) ? trelloData.cards : [];
        const basePath = '/' + listId + '/';
        let imported = 0;
        const createdTaskIds = [];
        for (const card of cards) {
            const taskId = randomUUID();
            const path = basePath + taskId + '/';
            const title = String(card?.name ?? 'Untitled').trim() || 'Untitled';
            const description = card?.desc ? String(card.desc) : null;
            const isClosed = card?.closed === true;
            const status = isClosed
                ? 'archived'
                : (card?.idList ? (listNameById.get(String(card.idList)) ?? 'todo') : 'todo');
            const dueDate = card?.due ? String(card.due) : null;
            await db.query(`INSERT INTO tasks (id, list_id, title, description, status, priority, due_date, path, created_by, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`, [taskId, listId, title, description, status, 'none', dueDate, path, req.auth.userId]);
            createdTaskIds.push(taskId);
            imported++;
        }
        res.status(201).json({ data: { imported, tasks: createdTaskIds } });
    }));
    // ── Asana JSON Import ───────────────────────────────────────────────────────
    // POST /import/asana
    // Accepts multipart/form-data: Asana JSON export file + listId field
    router.post('/import/asana', requireAuth, asyncHandler(async (req, res) => {
        const { fields, file } = await readMultipart(req);
        const listId = fields['listId'];
        if (!listId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'listId field is required');
        if (!file)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Asana JSON file is required');
        const meta = await repository.getListMetadata(listId);
        if (!meta)
            throw new AppError(ErrorCode.LIST_NOT_FOUND);
        const memberResult = await db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [meta.workspace_id, req.auth.userId]);
        if (!memberResult.rows[0])
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        let asanaData;
        try {
            asanaData = JSON.parse(file);
        }
        catch {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid JSON file');
        }
        const tasks = Array.isArray(asanaData?.data) ? asanaData.data : [];
        const mapAsanaPriority = (customFields) => {
            if (!Array.isArray(customFields))
                return 'none';
            const priorityField = customFields.find((f) => typeof f?.name === 'string' && f.name.toLowerCase() === 'priority');
            if (!priorityField || !priorityField.display_value)
                return 'none';
            const val = String(priorityField.display_value).toLowerCase();
            if (val === 'high')
                return 'high';
            if (val === 'medium')
                return 'normal';
            if (val === 'low')
                return 'low';
            return 'none';
        };
        let imported = 0;
        const createdTaskIds = [];
        const basePath = '/' + listId + '/';
        for (const item of tasks) {
            const taskId = randomUUID();
            const path = basePath + taskId + '/';
            const title = String(item?.name ?? 'Untitled').trim() || 'Untitled';
            const description = item?.notes ? String(item.notes) : null;
            const isCompleted = item?.completed === true;
            const status = isCompleted ? 'completed' : 'open';
            const priority = mapAsanaPriority(item?.custom_fields);
            const dueDate = item?.due_on ? String(item.due_on) : null;
            await db.query(`INSERT INTO tasks (id, list_id, title, description, status, priority, due_date, path, created_by, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`, [taskId, listId, title, description, status, priority, dueDate, path, req.auth.userId]);
            createdTaskIds.push(taskId);
            imported++;
            // Tags from tags[].name
            const tags = Array.isArray(item?.tags) ? item.tags : [];
            for (const tag of tags) {
                const tagName = typeof tag?.name === 'string' ? tag.name.trim() : null;
                if (tagName) {
                    await repository.addTag(taskId, tagName);
                }
            }
            // Subtasks from subtasks[]
            const subtasks = Array.isArray(item?.subtasks) ? item.subtasks : [];
            for (const sub of subtasks) {
                const subId = randomUUID();
                const subPath = path + subId + '/';
                const subTitle = String(sub?.name ?? 'Untitled').trim() || 'Untitled';
                const subCompleted = sub?.completed === true;
                const subStatus = subCompleted ? 'completed' : 'open';
                await db.query(`INSERT INTO tasks (id, list_id, title, status, priority, path, parent_id, created_by, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`, [subId, listId, subTitle, subStatus, 'none', subPath, taskId, req.auth.userId]);
                createdTaskIds.push(subId);
                imported++;
            }
        }
        res.status(201).json({ data: { imported, tasks: createdTaskIds } });
    }));
    return router;
}
//# sourceMappingURL=import-export.handler.js.map