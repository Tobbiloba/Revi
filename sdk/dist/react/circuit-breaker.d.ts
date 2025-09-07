/**
 * Multi-Level Circuit Breaker System
 * Prevents cascade failures and provides graceful degradation
 */
export type CircuitState = 'closed' | 'open' | 'half-open';
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTime: number;
    successThreshold: number;
    timeout: number;
    maxFailureRate: number;
    windowSize: number;
    minRequests: number;
}
export interface CircuitMetrics {
    requests: number;
    failures: number;
    successes: number;
    failureRate: number;
    averageResponseTime: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    state: CircuitState;
    openTime?: number;
    nextRetryTime?: number;
}
export interface FeatureConfig {
    name: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    fallbackEnabled: boolean;
    gracefulDegradation: boolean;
}
/**
 * Individual Circuit Breaker for a single endpoint/feature
 */
export declare class CircuitBreaker {
    private name;
    private config;
    private state;
    private metrics;
    private requestWindow;
    private listeners;
    constructor(name: string, config?: Partial<CircuitBreakerConfig>);
    /**
     * Execute operation through circuit breaker
     */
    execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    private recordSuccess;
    private recordFailure;
    private shouldOpen;
    private transitionToClosed;
    private transitionToOpen;
    private transitionToHalfOpen;
    private cleanupOldRequests;
    private updateMetrics;
    /**
     * Get current metrics
     */
    getMetrics(): CircuitMetrics;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Force state change (for testing)
     */
    forceState(state: CircuitState): void;
    /**
     * Reset circuit breaker
     */
    reset(): void;
    /**
     * Listen for state changes
     */
    onStateChange(callback: (state: CircuitState, metrics: CircuitMetrics) => void): () => void;
    private notifyListeners;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<CircuitBreakerConfig>): void;
}
/**
 * Multi-Level Circuit Breaker Manager
 */
export declare class CircuitBreakerManager {
    private circuitBreakers;
    private globalCircuitBreaker;
    private featureConfigs;
    private degradedFeatures;
    private listeners;
    constructor();
    /**
     * Register a feature with circuit breaker protection
     */
    registerFeature(name: string, feature: FeatureConfig, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Execute operation with multi-level protection
     */
    executeProtected<T>(featureName: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    private handleFeatureStateChange;
    private evaluateSystemHealth;
    private enableEmergencyMode;
    private disableEmergencyMode;
    private enableProgressiveDegradation;
    private disableProgressiveDegradation;
    /**
     * Get system health overview
     */
    getSystemHealth(): {
        globalState: CircuitState;
        featuresTotal: number;
        featuresHealthy: number;
        featuresFailed: number;
        featuresDegraded: number;
        emergencyMode: boolean;
        progressiveDegradation: boolean;
    };
    /**
     * Get metrics for all circuit breakers
     */
    getAllMetrics(): Map<string, CircuitMetrics>;
    /**
     * Get specific circuit breaker
     */
    getCircuitBreaker(featureName: string): CircuitBreaker | undefined;
    /**
     * Check if feature is degraded
     */
    isFeatureDegraded(featureName: string): boolean;
    /**
     * Reset all circuit breakers
     */
    resetAll(): void;
    /**
     * Listen for circuit breaker events
     */
    onEvent(callback: (event: string, data: any) => void): () => void;
    private notifyListeners;
    /**
     * Execute operation with circuit breaker protection
     */
    executeWithBreaker<T>(featureName: string, operation: () => Promise<T>, options?: {
        priority?: 'critical' | 'high' | 'medium' | 'low';
        region?: string;
        degradeGracefully?: boolean;
        degradedResponse?: any;
    }): Promise<T>;
    /**
     * Update global configuration
     */
    updateGlobalConfig(config: Partial<CircuitBreakerConfig>): void;
    /**
     * Get global statistics
     */
    getGlobalStats(): any;
    /**
     * Reset all statistics
     */
    resetStats(): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map