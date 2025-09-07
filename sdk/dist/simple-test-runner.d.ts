/**
 * Simple Test Runner for Resilience Components
 * Runs without external testing frameworks
 */
interface TestResult {
    name: string;
    success: boolean;
    duration: number;
    details?: any;
    error?: string;
}
export declare class SimpleResilienceTestRunner {
    private results;
    runAllTests(): Promise<void>;
    private runTest;
    private testRetryManager;
    private testCircuitBreaker;
    private testIdempotency;
    private testStorage;
    private testHealthMonitor;
    private testSyncManager;
    private testIntegration;
    private printSummary;
    getResults(): TestResult[];
}
export declare function runSimpleResilienceTests(): Promise<TestResult[]>;
export {};
//# sourceMappingURL=simple-test-runner.d.ts.map