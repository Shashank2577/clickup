import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, asyncHandler, validate, AppError, createServiceClient } from '@clickup/sdk';
import { ErrorCode, CreateTimeEntrySchema, UpdateTimeEntrySchema } from '@clickup/contracts';
import { TasksRepository } from './tasks.repository.js';
function toEntryDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        minutes: row.minutes,
        billable: row.billable,
        note: row.note,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        createdAt: row.created_at,
    };
}
// Task-level time entry routes — mounted at /:taskId/time-entries (mergeParams: true)
export function taskTimeEntriesRouter(db) {
    const router = Router({ mergeParams: true });
    const repository = new TasksRepository(db);
    // GET /:taskId/time-entries
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const entries = await repository.getTimeEntries(taskId);
        const total = entries.reduce((sum, e) => sum + e.minutes, 0);
        res.json({ data: entries.map(toEntryDto), meta: { totalMinutes: total } });
    }));
    // POST /:taskId/time-entries
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        const input = validate(CreateTimeEntrySchema, req.body);
        const started = new Date(input.startedAt);
        const ended = new Date(input.endedAt);
        if (ended <= started)
            throw new AppError(ErrorCode.TIME_ENTRY_INVALID_RANGE);
        const minutes = Math.round((ended.getTime() - started.getTime()) / 60_000);
        if (minutes <= 0)
            throw new AppError(ErrorCode.TIME_ENTRY_INVALID_RANGE);
        const entry = await repository.createTimeEntry({
            taskId,
            userId: req.auth.userId,
            minutes,
            billable: input.billable ?? false,
            ...(input.note !== undefined ? { note: input.note } : {}),
            startedAt: started,
            endedAt: ended,
        });
        res.status(201).json({ data: toEntryDto(entry) });
    }));
    // POST /:taskId/time-entries/timer/start — start a running timer
    router.post('/timer/start', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        // Check for existing active timer on this task for this user
        const { rows: active } = await db.query('SELECT id FROM time_entries WHERE task_id = $1 AND user_id = $2 AND ended_at IS NULL', [taskId, req.auth.userId]);
        if (active.length > 0) {
            throw new AppError(ErrorCode.TIME_ENTRY_INVALID_RANGE, 'A timer is already running for this task');
        }
        const isBillable = req.body?.billable ?? false;
        const id = randomUUID();
        const { rows } = await db.query('INSERT INTO time_entries (id, task_id, user_id, started_at, billable) VALUES ($1, $2, $3, NOW(), $4) RETURNING *', [id, taskId, req.auth.userId, isBillable]);
        res.status(201).json({ data: toEntryDto(rows[0]) });
    }));
    // POST /:taskId/time-entries/timer/stop — stop the running timer
    router.post('/timer/stop', requireAuth, asyncHandler(async (req, res) => {
        const { taskId } = req.params;
        const task = await repository.getTask(taskId);
        if (!task)
            throw new AppError(ErrorCode.TASK_NOT_FOUND);
        // Find active timer
        const { rows: timers } = await db.query('SELECT * FROM time_entries WHERE task_id = $1 AND user_id = $2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1', [taskId, req.auth.userId]);
        if (timers.length === 0) {
            throw new AppError(ErrorCode.TIME_ENTRY_NOT_FOUND, 'No active timer found for this task');
        }
        const timer = timers[0];
        const durationMinutes = Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60000);
        const { rows } = await db.query('UPDATE time_entries SET ended_at = NOW(), minutes = $1 WHERE id = $2 RETURNING *', [durationMinutes, timer.id]);
        res.json({ data: toEntryDto(rows[0]) });
    }));
    return router;
}
// Standalone time entry routes — mounted at /time-entries
export function timeEntriesRouter(db) {
    const router = Router();
    const repository = new TasksRepository(db);
    const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001';
    async function verifyMembership(workspaceId, userId) {
        const client = createServiceClient(identityUrl, {});
        try {
            const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId);
            const member = response.data?.data || response.data;
            if (!member)
                throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
        catch (err) {
            if (err instanceof AppError)
                throw err;
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        }
    }
    // GET /time-entries/timesheet?workspaceId=&from=&to=&userId=&groupBy=user|date
    // IMPORTANT: must be before /:entryId wildcard routes
    router.get('/timesheet', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, from, to, userId: filterUserId, groupBy } = req.query;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId is required');
        if (!from || !to)
            throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'from and to are required');
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new AppError(ErrorCode.VALIDATION_INVALID_DATE);
        }
        await verifyMembership(workspaceId, req.auth.userId);
        const conditions = [
            'sp.workspace_id = $1',
            'te.started_at >= $2',
            'te.started_at < $3',
        ];
        const params = [workspaceId, fromDate, toDate];
        if (filterUserId) {
            params.push(filterUserId);
            conditions.push('te.user_id = $' + params.length);
        }
        const whereClause = conditions.join(' AND ');
        const baseQuery = `
      FROM time_entries te
      JOIN tasks t ON t.id = te.task_id AND t.deleted_at IS NULL
      JOIN lists l ON l.id = t.list_id
      JOIN spaces sp ON sp.id = l.space_id
      WHERE ${whereClause}
    `;
        let rows;
        if (groupBy === 'user') {
            const { rows: r } = await db.query(`SELECT
           te.user_id AS "userId",
           SUM(te.minutes)::int AS "totalMinutes",
           SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END)::int AS "billableMinutes",
           COUNT(te.id)::int AS "entries"
         ${baseQuery}
         GROUP BY te.user_id
         ORDER BY "totalMinutes" DESC`, params);
            rows = r;
        }
        else {
            // groupBy=date (default)
            const { rows: r } = await db.query(`SELECT
           DATE(te.started_at) AS "date",
           SUM(te.minutes)::int AS "totalMinutes",
           SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END)::int AS "billableMinutes",
           COUNT(te.id)::int AS "entries"
         ${baseQuery}
         GROUP BY DATE(te.started_at)
         ORDER BY "date" ASC`, params);
            rows = r;
        }
        res.json({ data: rows });
    }));
    // PATCH /time-entries/:entryId
    router.patch('/:entryId', requireAuth, asyncHandler(async (req, res) => {
        const { entryId } = req.params;
        const entry = await repository.getTimeEntry(entryId);
        if (!entry)
            throw new AppError(ErrorCode.TIME_ENTRY_NOT_FOUND);
        if (entry.user_id !== req.auth.userId)
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const input = validate(UpdateTimeEntrySchema, req.body);
        const updates = {};
        if (input.startedAt !== undefined)
            updates['started_at'] = new Date(input.startedAt);
        if (input.endedAt !== undefined)
            updates['ended_at'] = new Date(input.endedAt);
        if (input.note !== undefined)
            updates['note'] = input.note;
        if (input.billable !== undefined)
            updates['billable'] = input.billable;
        // Recalculate minutes if times changed
        const newStart = updates['started_at'] ?? entry.started_at;
        const newEnd = updates['ended_at'] ?? entry.ended_at;
        if (new Date(newEnd) <= new Date(newStart)) {
            throw new AppError(ErrorCode.TIME_ENTRY_INVALID_RANGE);
        }
        updates['minutes'] = Math.round((new Date(newEnd).getTime() - new Date(newStart).getTime()) / 60_000);
        const updated = await repository.updateTimeEntry(entryId, updates);
        res.json({ data: toEntryDto(updated) });
    }));
    // DELETE /time-entries/:entryId
    router.delete('/:entryId', requireAuth, asyncHandler(async (req, res) => {
        const { entryId } = req.params;
        const entry = await repository.getTimeEntry(entryId);
        if (!entry)
            throw new AppError(ErrorCode.TIME_ENTRY_NOT_FOUND);
        if (entry.user_id !== req.auth.userId)
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        await repository.deleteTimeEntry(entryId);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=time-entries.handler.js.map