import express from 'express';
import { httpLogger, correlationId, errorHandler, subscribe, logger } from '@clickup/sdk';
import { db } from './goals/goals.repository.js';
import { routes } from './routes.js';
import { TASK_EVENTS } from '@clickup/contracts';
import { goalsService } from './goals/goals.service.js';
const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'goals-service';
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
async function bootstrap() {
    await db.query('SELECT 1');
    const app = express();
    app.use(httpLogger);
    app.use(correlationId);
    app.use(express.json({ limit: '1mb' }));
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.use('/', routes(db));
    app.use(errorHandler);
    await subscribe(TASK_EVENTS.COMPLETED, async (event) => {
        logger.info({ taskId: event.taskId }, 'task completed, updating linked goal targets');
        await goalsService.updateTargetValueForTask(event.taskId, 1);
    });
    app.listen(PORT, () => {
        logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started');
    });
}
bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map