import type { Request, Response } from 'express';
import type { Pool } from 'pg';
export declare function createHealthHandler(db: Pool): (_req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=handler.d.ts.map