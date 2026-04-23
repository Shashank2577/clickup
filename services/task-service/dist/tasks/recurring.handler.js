import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError } from '@clickup/sdk';
import { ErrorCode, CreateRecurringConfigSchema, UpdateRecurringConfigSchema, FREQUENCY_CRON_MAP, } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
import { randomUUID } from 'crypto';
function toConfigDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        cronExpr: row.cron_expr,
        nextRunAt: row.next_run_at,
        lastRunAt: row.last_run_at,
        isActive: row.is_active,
        createdAt: row.created_at,
    };
}
function computeNextRun() {
    // Simple: schedule 24h from now for first run
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d;
}
// Mounted at /:taskId/recurring (mergeParams: true)
export function recurringRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/recurring — get recurring config
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const { rows } = await db.query('SELECT * FROM recurring_task_configs WHERE task_id = $1', [taskId]);
        if (!rows.length)
            throw new AppError(ErrorCode.RECURRING_CONFIG_NOT_FOUND);
        res.json({ data: toConfigDto(rows[0]) });
    }));
    // PUT /:taskId/recurring — set or replace recurring config
    router.put('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const input = validate(CreateRecurringConfigSchema, req.body);
        const cronExpr = input.cronExpr ?? FREQUENCY_CRON_MAP[input.frequency];
        const nextRunAt = computeNextRun();
        const { rows } = await db.query(`INSERT INTO recurring_task_configs (task_id, cron_expr, next_run_at, is_active)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (task_id) DO UPDATE
         SET cron_expr = EXCLUDED.cron_expr,
             next_run_at = EXCLUDED.next_run_at,
             is_active = EXCLUDED.is_active
       RETURNING *`, [taskId, cronExpr, nextRunAt, input.isActive]);
        res.status(201).json({ data: toConfigDto(rows[0]) });
    }));
    // PATCH /:taskId/recurring — update existing config
    router.patch('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const { rows: existing } = await db.query('SELECT * FROM recurring_task_configs WHERE task_id = $1', [taskId]);
        if (!existing.length)
            throw new AppError(ErrorCode.RECURRING_CONFIG_NOT_FOUND);
        const input = validate(UpdateRecurringConfigSchema, req.body);
        const updates = {};
        if (input.isActive !== undefined)
            updates['is_active'] = input.isActive;
        if (input.cronExpr !== undefined)
            updates['cron_expr'] = input.cronExpr;
        else if (input.frequency !== undefined)
            updates['cron_expr'] = FREQUENCY_CRON_MAP[input.frequency];
        const fields = Object.keys(updates);
        if (!fields.length) {
            res.json({ data: toConfigDto(existing[0]) });
            return;
        }
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const { rows } = await db.query(`UPDATE recurring_task_configs SET ${setClause} WHERE task_id = $1 RETURNING *`, [taskId, ...Object.values(updates)]);
        res.json({ data: toConfigDto(rows[0]) });
    }));
    // DELETE /:taskId/recurring — remove recurring config
    router.delete('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const { rowCount } = await db.query('DELETE FROM recurring_task_configs WHERE task_id = $1', [taskId]);
        if (!rowCount)
            throw new AppError(ErrorCode.RECURRING_CONFIG_NOT_FOUND);
        res.status(204).end();
    }));
    return router;
}
// Background job: run due recurring tasks
// Called at startup with setInterval — creates next task instance from the recurring config
export function startRecurringTaskRunner(db) {
    const run = async () => {
        try {
            // Get all active configs due to run
            const { rows } = await db.query(`SELECT rtc.*, t.list_id, t.title, t.description, t.priority, t.assignee_id
         FROM recurring_task_configs rtc
         JOIN tasks t ON t.id = rtc.task_id
         WHERE rtc.is_active = TRUE
           AND rtc.next_run_at <= NOW()
           AND t.deleted_at IS NULL`);
            for (const config of rows) {
                // Create a new task instance
                const newId = randomUUID();
                await db.query(`INSERT INTO tasks (id, list_id, path, title, description, priority, assignee_id, created_by, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,0)`, [newId, config.list_id, newId, config.title, config.description, config.priority, config.assignee_id]);
                // Compute next run (simple: add 24h for now — proper cron parsing would use a cron lib)
                const next = new Date();
                next.setHours(next.getHours() + 24);
                await db.query('UPDATE recurring_task_configs SET last_run_at = NOW(), next_run_at = $2 WHERE id = $1', [config.id, next]);
            }
        }
        catch (err) {
            console.error('[recurring] runner error:', err);
        }
    };
    // Check every 5 minutes
    setInterval(run, 5 * 60 * 1000);
    // Run once at startup
    run();
}
//# sourceMappingURL=recurring.handler.js.map