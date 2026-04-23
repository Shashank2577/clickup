import { Router } from 'express';
import type { Pool } from 'pg';
/**
 * Main router for identity-service.
 * Base prefix /api/v1 handled by Express app, sub-prefixes here.
 * Mount order matters — more specific paths first.
 */
export declare function routes(db: Pool): Router;
//# sourceMappingURL=routes.d.ts.map