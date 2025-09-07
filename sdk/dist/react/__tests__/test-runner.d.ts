/**
 * Test Runner for Resilience Components
 * Provides practical examples and interactive testing scenarios
 */
export declare class ResilienceTestRunner {
    private coordinator;
    private testResults;
    constructor();
    /**
     * Run all resilience tests
     */
    runAllTests(): Promise<void>;
    /**
     * Test 1: Retry Mechanism with Exponential Backoff
     */
    testRetryMechanism(): Promise<void>;
    /**
     * Test 2: Circuit Breaker Protection
     */
    testCircuitBreaker(): Promise<void>;
    /**
     * Test 3: Idempotency and Deduplication
     */
    testIdempotency(): Promise<void>;
    /**
     * Test 4: Offline Storage and Sync
     */
    testOfflineStorage(): Promise<void>;
    /**
     * Test 5: Health Monitoring and Adaptive Behavior
     */
    testHealthMonitoring(): Promise<void>;
    /**
     * Test 6: Network Failure Scenarios
     */
    testNetworkFailures(): Promise<void>;
    /**
     * Test 7: Cascading Failure Protection
     */
    testCascadingFailures(): Promise<void>;
    /**
     * Test 8: High Load Performance
     */
    testHighLoad(): Promise<void>;
    /**
     * Test 9: Recovery Scenarios
     */
    testRecoveryScenarios(): Promise<void>;
    /**
     * Log test result
     */
    private logTestResult;
    /**
     * Print test summary
     */
    private printSummary;
    /**
     * Clean up resources
     */
    cleanup(): void;
}
export declare function runResilienceTests(): Promise<void>;
//# sourceMappingURL=test-runner.d.ts.map