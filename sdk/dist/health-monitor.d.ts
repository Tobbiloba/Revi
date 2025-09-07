/**
 * API Health Monitoring System
 * Continuous health assessment with adaptive behavior
 */
export interface HealthMetrics {
    responseTime: number[];
    successRate: number;
    errorRate: number;
    availability: number;
    lastCheck: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    totalErrors: number;
    uptime: number;
    downtime: number;
}
export interface HealthCheckConfig {
    interval: number;
    timeout: number;
    endpoint: string;
    method: 'GET' | 'HEAD' | 'POST';
    expectedStatus: number[];
    retryCount: number;
    failureThreshold: number;
    recoveryThreshold: number;
    degradationThreshold: number;
    critical: boolean;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastChecked: number;
    responseTime?: number;
    error?: string;
    metrics: HealthMetrics;
    trend: 'improving' | 'stable' | 'degrading';
    confidence: number;
}
export interface RegionalHealth {
    region: string;
    endpoint: string;
    status: HealthStatus;
    priority: number;
    lastFailover?: number;
}
/**
 * Health Monitor for individual endpoints
 */
export declare class EndpointHealthMonitor {
    private name;
    private config;
    private metrics;
    private checkInterval;
    private listeners;
    private requestHistory;
    private windowSize;
    private isRunning;
    constructor(name: string, config: Partial<HealthCheckConfig>);
    private initializeMetrics;
    /**
     * Start health monitoring
     */
    start(): void;
    /**
     * Stop health monitoring
     */
    stop(): void;
    private scheduleCheck;
    private performHealthCheck;
    private executeHealthCheck;
    private recordCheckResult;
    private cleanupOldHistory;
    private updateMetrics;
    private calculateHealthStatus;
    private sleep;
    /**
     * Get current health status
     */
    getHealthStatus(): HealthStatus;
    /**
     * Get current metrics
     */
    getMetrics(): HealthMetrics;
    /**
     * Force a health check
     */
    forceCheck(): Promise<HealthStatus>;
    /**
     * Listen for health status changes
     */
    onStatusChange(callback: (status: HealthStatus) => void): () => void;
    private notifyListeners;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<HealthCheckConfig>): void;
    /**
     * Reset metrics (useful for testing)
     */
    reset(): void;
}
/**
 * Multi-Regional Health Monitor
 */
export declare class MultiRegionalHealthMonitor {
    private regionalMonitors;
    private primaryRegion;
    private failoverHistory;
    private listeners;
    private adaptiveBehavior;
    constructor();
    /**
     * Register a regional endpoint
     */
    registerRegion(region: string, endpoint: string, priority: number, config?: Partial<HealthCheckConfig>): EndpointHealthMonitor;
    /**
     * Start monitoring all regions
     */
    startAll(): void;
    /**
     * Stop monitoring all regions
     */
    stopAll(): void;
    private handleRegionalStatusChange;
    private performFailover;
    /**
     * Get current primary region
     */
    getPrimaryRegion(): string | null;
    /**
     * Get health status for all regions
     */
    getAllRegionalHealth(): RegionalHealth[];
    /**
     * Get failover history
     */
    getFailoverHistory(): typeof this.failoverHistory;
    /**
     * Get adaptive behavior recommendations
     */
    getAdaptiveBehaviorRecommendations(): any;
    /**
     * Force failover to specific region
     */
    forceFailover(toRegion: string, reason?: string): void;
    /**
     * Listen for health monitor events
     */
    onEvent(callback: (event: string, data: any) => void): () => void;
    private notifyListeners;
    /**
     * Get global statistics
     */
    getGlobalStats(): any;
    /**
     * Reset all statistics
     */
    resetStats(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<HealthMonitorConfig>): void;
    /**
     * Destroy and cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=health-monitor.d.ts.map