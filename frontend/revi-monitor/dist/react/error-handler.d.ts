import type { Breadcrumb, ReviConfig } from './types';
import { TraceManager } from './trace-manager';
export declare class ErrorHandler {
    private config;
    private breadcrumbs;
    private userContext;
    private traceManager;
    constructor(config: ReviConfig, traceManager?: TraceManager);
    private setupGlobalHandlers;
    captureError(errorData: {
        message: string;
        stack?: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        error?: Error;
        level?: 'error' | 'warning' | 'info' | 'debug';
        tags?: Record<string, string>;
        extra?: Record<string, any>;
    }): string;
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
    addBreadcrumb(breadcrumb: Breadcrumb): void;
    setUserContext(user: any): void;
    setTags(tags: Record<string, string>): void;
    setExtra(extra: Record<string, any>): void;
    getBreadcrumbs(): Breadcrumb[];
    clearBreadcrumbs(): void;
}
//# sourceMappingURL=error-handler.d.ts.map