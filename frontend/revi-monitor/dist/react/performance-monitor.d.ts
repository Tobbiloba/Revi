import type { PerformanceEntry, WebVitals, ReviConfig } from './types';
export declare class PerformanceMonitor {
    private config;
    private webVitals;
    private performanceEntries;
    constructor(config: ReviConfig);
    private setupWebVitals;
    private calculateTTFB;
    private setupResourceTiming;
    private setupNavigationTiming;
    getWebVitals(): WebVitals;
    getPerformanceEntries(): PerformanceEntry[];
    clearPerformanceEntries(): void;
    mark(name: string): void;
    measure(name: string, startMark?: string, endMark?: string): number | null;
}
//# sourceMappingURL=performance-monitor.d.ts.map