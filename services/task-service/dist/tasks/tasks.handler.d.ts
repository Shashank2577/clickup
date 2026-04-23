import { Request, Response } from 'express';
import { Pool } from 'pg';
export declare function createTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function getTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function listTasksHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function updateTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function deleteTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function archiveTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function unarchiveTaskHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=tasks.handler.d.ts.map