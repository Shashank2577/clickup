export interface DataLoader<K, V> {
    load: (key: K) => Promise<V>;
    loadMany: (keys: K[]) => Promise<(V | Error)[]>;
    clear: (key: K) => void;
    clearAll: () => void;
}
export declare function createDataLoader<K extends string | number, V>(batchFn: (keys: K[]) => Promise<(V | null)[]>, options?: {
    maxBatchSize?: number;
    cacheKeyFn?: (key: K) => string;
}): DataLoader<K, V | null>;
//# sourceMappingURL=index.d.ts.map