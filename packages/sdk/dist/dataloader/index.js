"use strict";
// ============================================================
// DataLoader — prevents N+1 queries
// Batches multiple individual lookups into one DB query.
//
// Usage:
//   const loader = createDataLoader(async (ids) => {
//     const rows = await db.query('SELECT * FROM users WHERE id = ANY($1)', [ids])
//     return ids.map(id => rows.find(r => r.id === id) ?? null)
//   })
//   const user = await loader.load(userId)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDataLoader = createDataLoader;
function createDataLoader(batchFn, options = {}) {
    const { maxBatchSize = 100, cacheKeyFn = (key) => String(key) } = options;
    const cache = new Map();
    let batch = [];
    let batchScheduled = false;
    const resolvers = new Map();
    function scheduleBatch() {
        if (batchScheduled)
            return;
        batchScheduled = true;
        process.nextTick(() => {
            const currentBatch = batch.splice(0, maxBatchSize);
            batchScheduled = batch.length > 0;
            if (batch.length > 0) {
                scheduleBatch();
            }
            void batchFn(currentBatch).then((results) => {
                currentBatch.forEach((key, i) => {
                    const cacheKey = cacheKeyFn(key);
                    const result = results[i] ?? null;
                    const waiting = resolvers.get(cacheKey) ?? [];
                    waiting.forEach(({ resolve }) => resolve(result));
                    resolvers.delete(cacheKey);
                });
            }).catch((err) => {
                currentBatch.forEach((key) => {
                    const cacheKey = cacheKeyFn(key);
                    const waiting = resolvers.get(cacheKey) ?? [];
                    waiting.forEach(({ reject }) => reject(err));
                    resolvers.delete(cacheKey);
                    cache.delete(cacheKey);
                });
            });
        });
    }
    return {
        load(key) {
            const cacheKey = cacheKeyFn(key);
            const cached = cache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            const promise = new Promise((resolve, reject) => {
                const waiting = resolvers.get(cacheKey) ?? [];
                waiting.push({ resolve, reject });
                resolvers.set(cacheKey, waiting);
            });
            cache.set(cacheKey, promise);
            batch.push(key);
            scheduleBatch();
            return promise;
        },
        async loadMany(keys) {
            return Promise.all(keys.map((key) => this.load(key).catch((err) => err instanceof Error ? err : new Error(String(err)))));
        },
        clear(key) {
            cache.delete(cacheKeyFn(key));
        },
        clearAll() {
            cache.clear();
        },
    };
}
//# sourceMappingURL=index.js.map