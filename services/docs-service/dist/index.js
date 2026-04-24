import express from 'express';
import * as http from 'http';
import { Pool } from 'pg';
import { httpLogger, correlationId, errorHandler, logger, createHealthHandler, subscribe } from '@clickup/sdk';
import { TASK_EVENTS } from '@clickup/contracts';
import { createRouter } from './routes.js';
import { attachWebSocketServer } from './ws/ws.server.js';
const SERVICE_NAME = process.env['SERVICE_NAME'] || 'docs-service';
const PORT = parseInt(process.env['PORT'] || '3010', 10);
const db = new Pool({
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    database: process.env['POSTGRES_DB'] || 'clickup',
    user: process.env['POSTGRES_USER'] || 'clickup',
    password: process.env['POSTGRES_PASSWORD'] || 'clickup_dev',
});
async function bootstrap() {
    await db.query('SELECT 1');
    logger.info('Connected to PostgreSQL');
    const app = express();
    app.use(httpLogger);
    app.use(correlationId);
    app.use(express.json({ limit: '1mb' }));
    app.get('/health', createHealthHandler(db));
    app.use('/', createRouter(db));
    app.use(errorHandler);
    const server = http.createServer(app);
    attachWebSocketServer(server, db);
    server.listen(PORT, () => {
        logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started');
    });
    // NATS Subscriptions
    await subscribe(TASK_EVENTS.DELETED, async (payload) => {
        try {
            await db.query('UPDATE docs SET deleted_at = NOW() WHERE content->>\'taskId\' = $1 AND deleted_at IS NULL', [payload.taskId]);
            logger.info({ taskId: payload.taskId }, 'Soft-deleted docs for deleted task');
        }
        catch (err) {
            logger.error({ err, taskId: payload.taskId }, 'Failed to soft-delete docs for task');
            throw err;
        }
    }, { durable: 'docs-svc-task-deleted' });
}
bootstrap().catch((err) => {
    logger.error({ err }, 'Fatal bootstrap error');
    process.exit(1);
});
//# sourceMappingURL=index.js.map