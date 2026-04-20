import type { Request, Response, NextFunction } from 'express';
export declare function initRedis(): Promise<void>;
export declare function rateLimiter(isMutation: boolean): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rate-limiter.d.ts.map