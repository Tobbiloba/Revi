import type { ReviConfig, UserContext } from './types';
export declare class Monitor {
    private config;
    private traceManager;
    private errorHandler;
    private sessionManager;
    private networkMonitor;
    private performanceMonitor;
    private dataManager;
    private userJourneyTracker;
    private sessionReplayManager;
    private isInitialized;
    constructor(config: ReviConfig);
    private init;
    private setupPeriodicFlush;
    captureException(error: Error, options?: {
        level?: 'error' | 'warning' | 'info' | 'debug';
        tags?: Record<string, string>;
        extra?: Record<string, any>;
    }): string;
    captureMessage(message: string, options?: {
        level?: 'error' | 'warning' | 'info' | 'debug';
        tags?: Record<string, string>;
        extra?: Record<string, any>;
    }): string;
    addBreadcrumb(breadcrumb: {
        message: string;
        category?: string;
        level?: 'error' | 'warning' | 'info' | 'debug';
        data?: Record<string, any>;
    }): void;
    setUserContext(user: UserContext): void;
    setTags(tags: Record<string, string>): void;
    setExtra(extra: Record<string, any>): void;
    getSessionId(): string;
    endSession(): void;
    mark(name: string): void;
    measure(name: string, startMark?: string, endMark?: string): number | null;
    getWebVitals(): import("./types").WebVitals;
    startSessionReplay(): void;
    stopSessionReplay(): void;
    getSessionReplayData(): {
        events: import("./session-replay").ReplayEvent[];
        console_logs: import("./console-recorder").ConsoleLogEntry[];
        network_requests: import("./session-replay").NetworkRequest[];
        heatmap_data?: import("./heatmap-generator").HeatmapData[];
        session_info: {
            session_id: string;
            start_time: number;
            duration: number;
            page_url: string;
        };
        analytics: {
            console_insights: any;
            heatmap_insights?: any;
        };
    } | null;
    flush(): void;
    getCurrentTraceId(): string | undefined;
    getCurrentSpanId(): string | undefined;
    getTraceContext(): {
        traceId?: string;
        spanId?: string;
        parentSpanId?: string;
    };
    startSpan(operationName: string): string | undefined;
    finishSpan(spanId?: string, data?: Record<string, any>): void;
    destroy(): void;
}
//# sourceMappingURL=monitor.d.ts.map