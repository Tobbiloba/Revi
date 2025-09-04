/**
 * Advanced Retry Manager with sophisticated retry strategies
 * Implements jittered exponential backoff, failure classification, and retry budgets
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    jitterRatio: number;
    timeoutMultiplier: number;
    retryBudget: number;
    enableJitter: boolean;
}
export interface RetryableError {
    statusCode?: number;
    type: 'network' | 'timeout' | 'server' | 'client' | 'unknown';
    message: string;
    retryable: boolean;
    priority: 'critical' | 'high' | 'medium' | 'low';
}
export interface RetryAttempt {
    attempt: number;
    delay: number;
    timestamp: number;
    error?: RetryableError;
    duration?: number;
}
export interface RetryStats {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    averageDelay: number;
    budgetUsed: number;
    lastSuccess?: number;
    lastFailure?: number;
}
export declare class RetryManager {
    private config;
    private retryStats;
    private retryBudgetUsed;
    private lastBudgetReset;
    private budgetResetInterval;
    private requestDeduplication;
    private rateLimitedUntil;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Execute operation with advanced retry logic
     */
    executeWithRetry<T>(key: string, operation: () => Promise<T>, options?: {
        priority?: 'critical' | 'high' | 'medium' | 'low';
        timeout?: number;
        payloadSize?: number;
        deduplicationKey?: string;
    }): Promise<T>;
    private performRetryLoop;
    private executeWithTimeout;
    private classifyError;
    private createRetryableError;
    private shouldRetry;
    private calculateDelay;
    private handleRateLimit;
    private resetBudgetIfNeeded;
    private hasBudgetAvailable;
    private consumeRetryBudget;
    private getOrCreateStats;
    private sleep;
    /**
     * Get retry statistics for monitoring
     */
    getStats(key?: string): RetryStats | Map<string, RetryStats>;
    /**
     * Reset statistics (useful for testing)
     */
    resetStats(key?: string): void;
    /**
     * Check if currently rate limited
     */
    isRateLimited(): boolean;
    /**
     * Get remaining retry budget
     */
    getRemainingBudget(): number;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<RetryConfig>): void;
}
//# sourceMappingURL=retry-manager.d.ts.map