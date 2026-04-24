import express from 'express';
import { Pool } from 'pg';
import { httpLogger, correlationId, errorHandler, createHealthHandler } from '@clickup/sdk';
import { routes, workspaceCustomFieldsRouter, statusesRouter, taskTemplatesRouter, formsRouter, standaloneFormsRouter, taskTypesRouter, fieldPermissionsRouter, } from './routes.js';
import { startRecurringTaskRunner } from './tasks/recurring.handler.js';
const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'task-service';
const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const db = new Pool({
    host: process.env['POSTGRES_HOST'] ?? 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
    database: process.env['POSTGRES_DB'] ?? 'clickup',
    user: process.env['POSTGRES_USER'] ?? 'clickup',
    password: process.env['POSTGRES_PASSWORD'] ?? 'clickup_dev',
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});
async function bootstrap() {
    await db.query('SELECT 1');
    const app = express();
    app.use(httpLogger);
    app.use(correlationId);
    app.use(express.json({ limit: '1mb' }));
    // Health check
    app.get('/health', createHealthHandler(db));
    // ── Core task routes ─────────────────────────────────────────────────────────
    // Gateway strips /api/v1/tasks — upstream receives /:taskId, /list/:listId, etc.
    app.use('/', routes(db));
    // ── Custom field definitions ──────────────────────────────────────────────────
    // Gateway strips /api/v1/custom-fields — upstream receives /:workspaceId
    app.use('/custom-fields', workspaceCustomFieldsRouter(db));
    // ── Per-list statuses ─────────────────────────────────────────────────────────
    // Gateway /api/v1/list-statuses → strips only /api/v1 → upstream sees /list-statuses/:listId
    // taskTemplatesRouter uses mergeParams, listId param available
    app.use('/list-statuses/:listId', statusesRouter(db));
    // ── Task templates ────────────────────────────────────────────────────────────
    // Gateway /api/v1/task-templates → strips /api/v1 → upstream sees /task-templates/:workspaceId
    app.use('/task-templates/:workspaceId', taskTemplatesRouter(db));
    // ── Task types (custom task types) ───────────────────────────────────────────
    // Gateway /api/v1/task-types → strips /api/v1 → upstream sees /task-types/:workspaceId
    app.use('/task-types/:workspaceId', taskTypesRouter(db));
    // ── Forms ─────────────────────────────────────────────────────────────────────
    // Gateway /api/v1/task-forms → strips /api/v1 → upstream sees /task-forms/:listId
    app.use('/task-forms/:listId', formsRouter(db));
    // Gateway /api/v1/forms → strips /api/v1 → upstream sees /forms/...
    app.use('/forms', standaloneFormsRouter(db));
    // ── Field Permissions ────────────────────────────────────────────────────────
    // Gateway /api/v1/custom-fields/:fieldId/permissions
    app.use('/custom-fields/:fieldId/permissions', fieldPermissionsRouter(db));
    // Error handler — MUST be last
    app.use(errorHandler);
    app.listen(PORT, () => {
        console.warn(`${SERVICE_NAME} listening on :${PORT}`);
    });
    // Start recurring task cron runner
    startRecurringTaskRunner(db);
}
bootstrap().catch((err) => {
    console.error('Failed to start service:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map