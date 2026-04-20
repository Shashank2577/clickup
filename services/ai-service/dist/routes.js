import { Router } from 'express';
import { requireAuth, asyncHandler } from '@clickup/sdk';
export function routes() {
    const router = Router();
    const notImplemented = asyncHandler(async (_req, res) => {
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'AI capability not yet implemented', status: 501 } });
    });
    router.post('/api/v1/ai/task-breakdown', requireAuth, notImplemented);
    router.post('/api/v1/ai/summarize', requireAuth, notImplemented);
    router.post('/api/v1/ai/prioritize', requireAuth, notImplemented);
    router.post('/api/v1/ai/daily-plan', requireAuth, notImplemented);
    return router;
}
//# sourceMappingURL=routes.js.map