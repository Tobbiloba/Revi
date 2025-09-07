/**
 * Idempotency and Request Deduplication Manager
 * Ensures safe retries and prevents duplicate operations across the resilience system
 */
export interface IdempotencyConfig {
    keyTTL: number;
    maxConcurrentRequests: number;
    enableResponseCaching: boolean;
    responseCacheTTL: number;
    enableRequestFingerprinting: boolean;
    maxStoredKeys: number;
}
export interface RequestFingerprint {
    method: string;
    url: string;
    headers: Record<string, string>;
    bodyHash?: string;
    timestamp: number;
}
export interface IdempotentRequest {
    key: string;
    fingerprint: RequestFingerprint;
    status: 'pending' | 'completed' | 'failed';
    promise?: Promise<any>;
    response?: any;
    error?: Error;
    attempts: number;
    createdAt: number;
    lastAttemptAt: number;
    completedAt?: number;
}
export interface DeduplicationStats {
    totalRequests: number;
    deduplicatedRequests: number;
    cacheHits: number;
    activePendingRequests: number;
    memoryUsage: number;
    keyCleanups: number;
}
export declare class IdempotencyManager {
    private config;
    private requestMap;
    private responseCache;
    private pendingRequests;
    private keyCleanupInterval;
    private stats;
    constructor(config?: Partial<IdempotencyConfig>);
    /**
     * Execute request with idempotency protection
     */
    executeIdempotent<T>(key: string, operation: () => Promise<T>, options?: {
        method?: string;
        url?: string;
        headers?: Record<string, string>;
        body?: any;
        bypassCache?: boolean;
        priority?: 'critical' | 'high' | 'medium' | 'low';
    }): Promise<T>;
    private performIdempotentOperation;
    /**
     * Generate request fingerprint for complex deduplication
     */
    private generateRequestFingerprint;
    private normalizeHeaders;
    private hashRequestBody;
    /**
     * Get cached response if available and not expired
     */
    private getCachedResponse;
    /**
     * Cache successful response
     */
    private cacheResponse;
    /**
     * Generate idempotency key from request data
     */
    generateIdempotencyKey(method: string, url: string, body?: any, userContext?: string): string;
    /**
     * Check if request is currently pending
     */
    isPending(key: string): boolean;
    /**
     * Get request information
     */
    getRequestInfo(key: string): IdempotentRequest | null;
    /**
     * Cancel pending request
     */
    cancelRequest(key: string): boolean;
    /**
     * Clear expired entries and manage memory
     */
    private startKeyCleanup;
    private cleanupExpiredEntries;
    private updateStats;
    /**
     * Get deduplication statistics
     */
    getStats(): DeduplicationStats;
    /**
     * Reset statistics (useful for testing)
     */
    resetStats(): void;
    /**
     * Clear all stored data
     */
    clear(): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IdempotencyConfig>): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
/**
 * Utility functions for common idempotency patterns
 */
export declare class IdempotencyUtils {
    /**
     * Generate idempotency key for error reporting
     */
    static errorReportingKey(projectId: string, errorHash: string, sessionId: string, timestamp?: number): string;
    /**
     * Generate idempotency key for session events
     */
    static sessionEventKey(projectId: string, sessionId: string, eventType: string, sequence: number): string;
    /**
     * Generate idempotency key for network events
     */
    static networkEventKey(projectId: string, sessionId: string, method: string, url: string, timestamp: number): string;
    /**
     * Generate idempotency key for batch operations
     */
    static batchOperationKey(operation: string, batchId: string, checksum: string): string;
}
//# sourceMappingURL=idempotency-manager.d.ts.map