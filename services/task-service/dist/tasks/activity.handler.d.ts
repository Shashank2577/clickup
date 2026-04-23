import { Router } from 'express';
import { Pool } from 'pg';
export declare function activityRouter(db: Pool): Router;
export declare function logActivity(db: Pool, entry: {
    taskId: string;
    userId: string | null;
    action: string;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
}): Promise<void>;
//# sourceMappingURL=activity.handler.d.ts.map