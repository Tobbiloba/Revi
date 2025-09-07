/**
 * Comprehensive debug logger for Revi SDK
 * Tracks all inputs, outputs, and transformations for debugging
 */
export interface DebugLogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    category: 'session' | 'network' | 'error' | 'data' | 'api' | 'general';
    operation: string;
    data: any;
    sessionId?: string;
    stackTrace?: string;
}
export declare class DebugLogger {
    private logs;
    private isEnabled;
    private saveToFile;
    private maxLogs;
    constructor(enabled?: boolean, saveToFile?: boolean);
    log(category: DebugLogEntry['category'], operation: string, message: string, data?: any): void;
    logError(category: DebugLogEntry['category'], operation: string, error: Error, data?: any): void;
    logSessionEvent(operation: string, sessionId: string, eventData: any): void;
    logApiCall(operation: string, url: string, payload: any, response?: any, error?: Error): void;
    logDataTransformation(operation: string, before: any, after: any, sessionId?: string): void;
    logSessionEventUpload(events: any[], sessionId: string, payload: any): void;
    private addLogEntry;
    private consoleLog;
    private sanitizeData;
    private getStackTrace;
    private saveTimer;
    private debouncedSave;
    saveToJsonFile(): void;
    getLogs(category?: DebugLogEntry['category'], operation?: string): DebugLogEntry[];
    getSummary(): any;
    clear(): void;
    setEnabled(enabled: boolean): void;
}
export declare function getDebugLogger(): DebugLogger;
export declare function initDebugLogger(enabled: boolean, saveToFile?: boolean): DebugLogger;
//# sourceMappingURL=debug-logger.d.ts.map