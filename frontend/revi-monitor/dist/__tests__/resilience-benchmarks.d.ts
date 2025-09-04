/**
 * Performance Benchmarks for Resilience System
 * Measures overhead and performance characteristics of resilience components
 */
export declare class ResiliencePerformanceMonitor {
    private samples;
    private config;
    recordOperation(operation: string, duration: number, success: boolean): void;
    private checkPerformance;
    getPerformanceReport(): {
        totalOperations: number;
        averageDuration: number;
        successRate: number;
        operationBreakdown: Record<string, {
            count: number;
            averageDuration: number;
            successRate: number;
        }>;
    };
}
//# sourceMappingURL=resilience-benchmarks.d.ts.map