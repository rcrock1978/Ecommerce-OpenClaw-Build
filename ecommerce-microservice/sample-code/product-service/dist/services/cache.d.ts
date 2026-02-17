export declare class CacheService {
    private redisClient;
    constructor();
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<void>;
    invalidateByPattern(pattern: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    increment(key: string): Promise<number>;
}
//# sourceMappingURL=cache.d.ts.map