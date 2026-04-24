import { Router } from 'express';
import { requireAuth } from '@clickup/sdk';
import { createTaskHandler, getTaskHandler, listTasksHandler, updateTaskHandler, deleteTaskHandler, archiveTaskHandler, unarchiveTaskHandler, } from './tasks/tasks.handler.js';
import { relationsRouter } from './tasks/relations.handler.js';
import { watchersRouter } from './tasks/watchers.handler.js';
import { checklistsRouter, checklistItemsRouter, checklistItemRouter } from './tasks/checklists.handler.js';
import { taskTimeEntriesRouter, timeEntriesRouter } from './tasks/time-entries.handler.js';
import { bulkRouter } from './tasks/bulk.handler.js';
import { taskCustomFieldsRouter, workspaceCustomFieldsRouter } from './tasks/custom-fields.handler.js';
import { statusesRouter } from './tasks/statuses.handler.js';
import { activityRouter } from './tasks/activity.handler.js';
import { taskTemplatesRouter } from './tasks/templates.handler.js';
import { formsRouter, standaloneFormsRouter } from './tasks/forms.handler.js';
import { fieldPermissionsRouter } from './tasks/field-permissions.handler.js';
import { recurringRouter } from './tasks/recurring.handler.js';
import { importExportRouter } from './tasks/import-export.handler.js';
import { duplicateRouter } from './tasks/duplicate.handler.js';
import { assigneesRouter } from './tasks/assignees.handler.js';
import { reorderRouter } from './tasks/reorder.handler.js';
import { shareLinksRouter, publicShareHandler } from './tasks/share-links.handler.js';
import { pinnedRouter, listPinnedHandler } from './tasks/pinned.handler.js';
import { taskTypesRouter } from './tasks/task-types.handler.js';
import { mirrorsRouter } from './tasks/mirrors.handler.js';
import { ganttRouter } from './tasks/gantt.handler.js';
import { mergeRouter } from './tasks/merge.handler.js';
import { taskPermissionsRouter } from './tasks/task-permissions.handler.js';
import { quickCreateHandler } from './tasks/quick-create.handler.js';
import { emailInboundHandler, emailRouter } from './tasks/email.handler.js';
export function routes(db) {
    const router = Router();
    // ── Import / Export ────────────────────────────────────────────────────────
    // Must be before /:taskId wildcard routes
    router.use('/', importExportRouter(db));
    // ── Gantt Chart Data ───────────────────────────────────────────────────────
    // Must be before /:taskId wildcard routes
    router.use('/gantt', requireAuth, ganttRouter(db));
    // ── Reorder (lists/:listId/tasks|statuses/reorder) ─────────────────────────
    // Must be before /:taskId wildcard routes
    router.use('/lists', reorderRouter(db));
    // ── Public Share (no auth) — must be before /:taskId ──────────────────────
    router.get('/share/:token', publicShareHandler(db));
    // ── Pinned Tasks — list-level ──────────────────────────────────────────────
    // Must be before /:taskId wildcard routes
    router.get('/lists/:listId/pinned', requireAuth, listPinnedHandler(db));
    // ── Email-to-task inbound webhook (no auth) — must be before /:taskId ─────
    router.post('/email/inbound', emailInboundHandler(db));
    // ── Quick Create — lightweight task creation (before /:taskId wildcard) ────
    router.post('/quick', requireAuth, quickCreateHandler(db));
    // ── Task CRUD ──────────────────────────────────────────────────────────────
    router.post('/', requireAuth, createTaskHandler(db));
    router.get('/list/:listId', requireAuth, listTasksHandler(db));
    router.get('/:taskId', requireAuth, getTaskHandler(db));
    router.patch('/:taskId', requireAuth, updateTaskHandler(db));
    router.delete('/:taskId', requireAuth, deleteTaskHandler(db));
    // ── Archive / Unarchive ────────────────────────────────────────────────────
    router.post('/:taskId/archive', requireAuth, archiveTaskHandler(db));
    router.post('/:taskId/unarchive', requireAuth, unarchiveTaskHandler(db));
    // ── Bulk Operations ────────────────────────────────────────────────────────
    router.use('/bulk-update', bulkRouter(db));
    // ── Task Duplication ───────────────────────────────────────────────────────
    router.use('/:taskId/duplicate', duplicateRouter(db));
    // ── Multiple Assignees ─────────────────────────────────────────────────────
    router.use('/:taskId/assignees', assigneesRouter(db));
    // ── Share Links ────────────────────────────────────────────────────────────
    router.use('/:taskId/share', shareLinksRouter(db));
    // ── Pin / Unpin ────────────────────────────────────────────────────────────
    router.use('/:taskId/pin', pinnedRouter(db));
    // ── Relations ──────────────────────────────────────────────────────────────
    router.use('/:taskId/relations', relationsRouter(db));
    // ── Watchers ───────────────────────────────────────────────────────────────
    router.use('/:taskId/watchers', watchersRouter(db));
    // ── Checklists ─────────────────────────────────────────────────────────────
    router.use('/:taskId/checklists', checklistsRouter(db));
    router.use('/checklists', checklistItemsRouter(db));
    router.use('/checklist-items', checklistItemRouter(db));
    // ── Time Entries ───────────────────────────────────────────────────────────
    router.use('/:taskId/time-entries', taskTimeEntriesRouter(db));
    router.use('/time-entries', timeEntriesRouter(db));
    // ── Custom Fields ──────────────────────────────────────────────────────────
    router.use('/:taskId/custom-fields', taskCustomFieldsRouter(db));
    // ── Activity Log ───────────────────────────────────────────────────────────
    router.use('/:taskId/activity', activityRouter(db));
    // ── Recurring Tasks ────────────────────────────────────────────────────────
    router.use('/:taskId/recurring', recurringRouter(db));
    // ── Task Merge ──────────────────────────────────────────────────────────────
    router.use('/:taskId/merge', mergeRouter(db));
    // ── Task Permissions ───────────────────────────────────────────────────────
    router.use('/:taskId/permissions', taskPermissionsRouter(db));
    // ── Send Email from Task ────────────────────────────────────────────────────
    router.use('/:taskId/email', emailRouter(db));
    // ── Task Mirrors (multi-home) ──────────────────────────────────────────────
    router.use('/:taskId/mirrors', mirrorsRouter(db));
    return router;
}
// ── Routes mounted outside /tasks prefix in index.ts ─────────────────────────
// Workspace-level: /custom-fields/:workspaceId
export { workspaceCustomFieldsRouter };
// Per-list statuses: /lists/:listId/statuses
export { statusesRouter };
// Task templates: /workspaces/:workspaceId/task-templates
export { taskTemplatesRouter };
// Forms: /lists/:listId/forms + /forms/:formId
export { formsRouter, standaloneFormsRouter };
// Task types: /workspaces/:workspaceId/task-types
export { taskTypesRouter };
// Field permissions: /custom-fields/:fieldId/permissions
export { fieldPermissionsRouter };
//# sourceMappingURL=routes.js.map