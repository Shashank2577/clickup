import { Request, Response } from 'express';
import { Pool } from 'pg';
export declare function createDocHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function getDocHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function updateDocHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function deleteDocHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function getSharedDocHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function listDocPermissionsHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function grantDocPermissionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function revokeDocPermissionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function createShareLinkHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function deleteShareLinkHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function listDocVersionsHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function getDocVersionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare function restoreDocVersionHandler(db: Pool): (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=docs.handler.d.ts.map