import type { ReviConfig, UserContext } from './types';
export declare class Monitor {
    private config;
    private errorHandler;
    private sessionManager;
    private networkMonitor;
    private performanceMonitor;
    private dataManager;
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
    flush(): void;
    destroy(): void;
}
//# sourceMappingURL=monitor.d.ts.map