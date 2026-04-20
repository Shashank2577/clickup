import Redis from 'ioredis';
export declare function getRedis(): Redis;
export declare function createRequestCache(): Map<string, unknown>;
export declare function requestCacheGet<T>(cache: Map<string, unknown>, key: string): T | undefined;
export declare function requestCacheSet(cache: Map<string, unknown>, key: string, value: unknown): void;
export declare function tier2Get<T>(key: string): Promise<T | null>;
export declare function tier2Set(key: string, value: unknown): Promise<void>;
export declare function tier2Del(key: string): Promise<void>;
export declare function tier3Get<T>(key: string): Promise<T | null>;
export declare function tier3Set(key: string, value: unknown): Promise<void>;
export declare function tier3Del(key: string): Promise<void>;
export declare const CacheKeys: {
    workspaceMembers: (workspaceId: string) => string;
    userProfile: (userId: string) => string;
    spaceHierarchy: (workspaceId: string) => string;
    taskSubtreeCount: (taskId: string) => string;
    listTaskCount: (listId: string) => string;
    goalProgress: (goalId: string) => string;
};
//# sourceMappingURL=client.d.ts.map