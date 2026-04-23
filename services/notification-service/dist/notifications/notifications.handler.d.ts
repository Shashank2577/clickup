import { Request, Response } from 'express';
import { Pool } from 'pg';
export declare function getPreferences(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function updatePreferences(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function listNotifications(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function markOneRead(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function markAllRead(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function deleteNotification(db: Pool): (req: Request, res: Response) => Promise<void>;
export declare function getUnreadCount(db: Pool): (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=notifications.handler.d.ts.map