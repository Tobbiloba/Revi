/**
 * Resilience Coordinator - Central orchestrator for all resilience components
 * Coordinates retry management, circuit breakers, storage, health monitoring, and idempotency
 */
import { RetryConfig } from './retry-manager';
import { CircuitBreakerConfig } from './circuit-breaker';
import { ResilientStorageConfig } from './resilient-storage';
import { HealthMonitorConfig } from './health-monitor';
import { SyncConfig } from './sync-manager';
import { IdempotencyConfig } from './idempotency-manager';
export interface ResilienceConfig {
    retry: Partial<RetryConfig>;
    circuitBreaker: Partial<CircuitBreakerConfig>;
    storage: Partial<ResilientStorageConfig>;
    healthMonitor: Partial<HealthMonitorConfig>;
    sync: Partial<SyncConfig>;
    idempotency: Partial<IdempotencyConfig>;
    enableAdaptiveBehavior: boolean;
    performanceThresholds: {
        slowRequestMs: number;
        verySlowRequestMs: number;
        highErrorRate: number;
        criticalErrorRate: number;
    };
}
export interface ResilienceStats {
    retry: any;
    circuitBreaker: any;
    storage: any;
    healthMonitor: any;
    sync: any;
    idempotency: any;
    adaptiveBehavior: {
        currentMode: 'normal' | 'degraded' | 'emergency';
        adaptationCount: number;
        lastAdaptation: number;
    };
}
export interface RequestOptions {
    priority: 'critical' | 'high' | 'medium' | 'low';
    timeout?: number;
    payloadSize?: number;
    idempotencyKey?: string;
    bypassCache?: boolean;
    feature: string;
    region?: string;
}
export declare class ResilienceCoordinator {
    private config;
    private retryManager;
    private circuitBreakerManager;
    private storage;
    private healthMonitor;
    private syncManager;
    private idempotencyManager;
    private adaptiveBehavior;
    private performanceHistory;
    constructor(config?: Partial<ResilienceConfig>);
    /**
     * Execute request with full resilience protection
     */
    executeResilientRequest<T>(operation: () => Promise<T>, options: RequestOptions): Promise<T>;
    private executeWithRetryAndHealth;
    private adaptRequestToHealth;
    private shouldStoreForLaterSync;
    private storeForLaterSync;
    /**
     * Sync failed requests when connectivity is restored
     */
    syncFailedRequests(): Promise<void>;
    /**
     * Start adaptive behavior monitoring
     */
    private startAdaptiveBehaviorMonitoring;
    private evaluateAndAdaptBehavior;
    private applyAdaptiveBehaviorMode;
    private recordPerformance;
    private getRecentPerformance;
    /**
     * Get comprehensive resilience statistics
     */
    getStats(): ResilienceStats;
    /**
     * Reset all statistics (useful for testing)
     */
    resetAllStats(): void;
    /**
     * Update configuration for all components
     */
    updateConfig(newConfig: Partial<ResilienceConfig>): void;
    /**
     * Cleanup all resources
     */
    destroy(): void;
}
//# sourceMappingURL=resilience-coordinator.d.ts.map