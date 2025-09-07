import type { ReviConfig } from './types';
export declare class SamplingManager {
    private config;
    private activityLevel;
    private lastActivity;
    private errorFrequency;
    private performanceImpact;
    constructor(config: ReviConfig);
    private startPerformanceMonitoring;
    private assessPerformanceImpact;
    updateActivityLevel(activity: 'high' | 'medium' | 'low' | 'idle'): void;
    incrementErrorFrequency(): void;
    shouldSampleError(): boolean;
    shouldSampleSession(): boolean;
    shouldSamplePerformance(): boolean;
    shouldSampleNetwork(): boolean;
    shouldSampleReplay(): boolean;
    getAdaptiveBatchSize(baseSize: number): number;
    getAdaptiveUploadDelay(baseDelay: number): number;
    shouldSkipCapture(eventType: 'error' | 'session' | 'performance' | 'network' | 'replay'): boolean;
    getPerformanceImpact(): number;
    getActivityLevel(): number;
    getErrorFrequency(): number;
}
//# sourceMappingURL=sampling-manager.d.ts.map