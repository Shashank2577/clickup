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

export interface DataLoader<K, V> {
  load: (key: K) => Promise<V>
  loadMany: (keys: K[]) => Promise<(V | Error)[]>
  clear: (key: K) => void
  clearAll: () => void
}

export function createDataLoader<K extends string | number, V>(
  batchFn: (keys: K[]) => Promise<(V | null)[]>,
  options: { maxBatchSize?: number; cacheKeyFn?: (key: K) => string } = {},
): DataLoader<K, V | null> {
  const { maxBatchSize = 100, cacheKeyFn = (key) => String(key) } = options

  const cache = new Map<string, Promise<V | null>>()
  let batch: K[] = []
  let batchScheduled = false
  const resolvers = new Map<string, Array<{ resolve: (v: V | null) => void; reject: (e: unknown) => void }>>()

  function scheduleBatch(): void {
    if (batchScheduled) return
    batchScheduled = true

    process.nextTick(() => {
      const currentBatch = batch.splice(0, maxBatchSize)
      batchScheduled = batch.length > 0

      if (batch.length > 0) {
        scheduleBatch()
      }

      void batchFn(currentBatch).then((results) => {
        currentBatch.forEach((key, i) => {
          const cacheKey = cacheKeyFn(key)
          const result = results[i] ?? null
          const waiting = resolvers.get(cacheKey) ?? []
          waiting.forEach(({ resolve }) => resolve(result))
          resolvers.delete(cacheKey)
        })
      }).catch((err: unknown) => {
        currentBatch.forEach((key) => {
          const cacheKey = cacheKeyFn(key)
          const waiting = resolvers.get(cacheKey) ?? []
          waiting.forEach(({ reject }) => reject(err))
          resolvers.delete(cacheKey)
          cache.delete(cacheKey)
        })
      })
    })
  }

  return {
    load(key: K): Promise<V | null> {
      const cacheKey = cacheKeyFn(key)
      const cached = cache.get(cacheKey)
      if (cached !== undefined) return cached

      const promise = new Promise<V | null>((resolve, reject) => {
        const waiting = resolvers.get(cacheKey) ?? []
        waiting.push({ resolve, reject })
        resolvers.set(cacheKey, waiting)
      })

      cache.set(cacheKey, promise)
      batch.push(key)
      scheduleBatch()
      return promise
    },

    async loadMany(keys: K[]): Promise<(V | null | Error)[]> {
      return Promise.all(
        keys.map((key) =>
          this.load(key).catch((err: unknown) =>
            err instanceof Error ? err : new Error(String(err)),
          ),
        ),
      )
    },

    clear(key: K): void {
      cache.delete(cacheKeyFn(key))
    },

    clearAll(): void {
      cache.clear()
    },
  }
}
