"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeys = void 0;
exports.getRedis = getRedis;
exports.createRequestCache = createRequestCache;
exports.requestCacheGet = requestCacheGet;
exports.requestCacheSet = requestCacheSet;
exports.tier2Get = tier2Get;
exports.tier2Set = tier2Set;
exports.tier2Del = tier2Del;
exports.tier3Get = tier3Get;
exports.tier3Set = tier3Set;
exports.tier3Del = tier3Del;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_js_1 = require("../logging/logger.js");
// ============================================================
// Three-tier cache client
// Tier 1: Request-scoped (in-memory Map, per request lifetime)
// Tier 2: Short-lived Redis (60s TTL — workspace members, user profiles)
// Tier 3: Long-lived Redis (5min TTL — computed aggregates, rollups)
// ============================================================
let redisClient = null;
function getRedis() {
    if (redisClient === null) {
        redisClient = new ioredis_1.default({
            host: process.env['REDIS_HOST'] ?? 'localhost',
            port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
            password: process.env['REDIS_PASSWORD'],
            lazyConnect: true,
            retryStrategy: (times) => Math.min(times * 100, 3000),
        });
        redisClient.on('error', (err) => {
            logger_js_1.logger.error({ err }, 'Redis connection error');
        });
    }
    return redisClient;
}
// ============================================================
// Tier 1: Request-scoped cache
// Use for: permission checks within a single request
// ============================================================
function createRequestCache() {
    return new Map();
}
function requestCacheGet(cache, key) {
    return cache.get(key);
}
function requestCacheSet(cache, key, value) {
    cache.set(key, value);
}
// ============================================================
// Tier 2: Short-lived Redis cache (60 seconds)
// Use for: workspace members, user profiles, space hierarchy
// ============================================================
const TIER2_TTL = 60;
async function tier2Get(key) {
    try {
        const value = await getRedis().get(key);
        if (value === null)
            return null;
        return JSON.parse(value);
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier2 cache get failed');
        return null;
    }
}
async function tier2Set(key, value) {
    try {
        await getRedis().setex(key, TIER2_TTL, JSON.stringify(value));
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier2 cache set failed');
    }
}
async function tier2Del(key) {
    try {
        await getRedis().del(key);
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier2 cache del failed');
    }
}
// ============================================================
// Tier 3: Long-lived Redis cache (5 minutes)
// Use for: task counts, rollup aggregates, computed metrics
// ============================================================
const TIER3_TTL = 300;
async function tier3Get(key) {
    try {
        const value = await getRedis().get(key);
        if (value === null)
            return null;
        return JSON.parse(value);
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier3 cache get failed');
        return null;
    }
}
async function tier3Set(key, value) {
    try {
        await getRedis().setex(key, TIER3_TTL, JSON.stringify(value));
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier3 cache set failed');
    }
}
async function tier3Del(key) {
    try {
        await getRedis().del(key);
    }
    catch (err) {
        logger_js_1.logger.warn({ err, key }, 'Tier3 cache del failed');
    }
}
// ============================================================
// Cache key builders — consistent naming across all services
// ============================================================
exports.CacheKeys = {
    workspaceMembers: (workspaceId) => `ws:members:${workspaceId}`,
    userProfile: (userId) => `user:profile:${userId}`,
    spaceHierarchy: (workspaceId) => `ws:spaces:${workspaceId}`,
    taskSubtreeCount: (taskId) => `task:subtree:${taskId}`,
    listTaskCount: (listId) => `list:count:${listId}`,
    goalProgress: (goalId) => `goal:progress:${goalId}`,
    doc: (docId) => `doc:${docId}`,
    docList: (workspaceId) => `doc:list:${workspaceId}`,
};
//# sourceMappingURL=client.js.map