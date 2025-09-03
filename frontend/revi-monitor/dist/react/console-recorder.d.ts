import { SessionEvent } from './types';
export interface ConsoleLogEntry {
    id: string;
    timestamp: number;
    level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
    args: any[];
    stack?: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
}
export interface ConsoleRecorderConfig {
    maxEntries: number;
    captureStackTrace: boolean;
    serializeObjects: boolean;
    maxObjectDepth: number;
    maxStringLength: number;
    ignoredLevels: string[];
}
export declare class ConsoleRecorder {
    private originalMethods;
    private entries;
    private config;
    private isRecording;
    private sessionId;
    constructor(sessionId: string, config?: Partial<ConsoleRecorderConfig>);
    start(): void;
    stop(): void;
    private recordEntry;
    private serializeArgs;
    private serializeValue;
    private cleanStackTrace;
    private addEntry;
    private generateId;
    getEntries(fromTimestamp?: number, toTimestamp?: number): ConsoleLogEntry[];
    getEntriesByLevel(level: ConsoleLogEntry['level']): ConsoleLogEntry[];
    clear(): void;
    toSessionEvents(): SessionEvent[];
    exportData(): {
        sessionId: string;
        config: ConsoleRecorderConfig;
        entries: ConsoleLogEntry[];
        stats: {
            totalEntries: number;
            levelCounts: Record<string, number>;
            errorCount: number;
            warningCount: number;
            timeRange: {
                start: number;
                end: number;
            };
        };
    };
    generateInsights(): {
        errorPatterns: Array<{
            pattern: string;
            count: number;
            examples: ConsoleLogEntry[];
        }>;
        performanceIssues: Array<{
            type: string;
            severity: 'low' | 'medium' | 'high';
            details: string;
        }>;
        recommendations: string[];
    };
    private findErrorPatterns;
    private detectPerformanceIssues;
    private generateRecommendations;
}
//# sourceMappingURL=console-recorder.d.ts.map