import { Request, Response } from 'express';
import { Pool } from 'pg';
export declare function createCommentHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function listCommentsHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function createDocCommentHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function listDocCommentsHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function updateCommentHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function deleteCommentHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function resolveCommentHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function addReactionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function removeReactionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function createReplyHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function getRepliesHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=comments.handler.d.ts.map