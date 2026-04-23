import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
export declare function commentAssignmentsRouter(db: Pool): Router;
export declare function myAssignedCommentsHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=assignments.handler.d.ts.map