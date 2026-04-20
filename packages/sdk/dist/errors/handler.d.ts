import type { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void;
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=handler.d.ts.map