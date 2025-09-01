import { formatStackTrace, generateId } from './utils';
import type { ErrorEvent, Breadcrumb, ReviConfig } from './types';

export class ErrorHandler {
  private config: ReviConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private userContext: any = {};

  constructor(config: ReviConfig) {
    this.config = config;
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack = '';

      if (error instanceof Error) {
        message = error.message;
        stack = formatStackTrace(error);
      } else if (typeof error === 'string') {
        message = error;
      } else {
        message = JSON.stringify(error);
      }

      this.captureError({
        message,
        stack,
        error
      });
    });

    // Console error interception
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      this.addBreadcrumb({
        timestamp: Date.now(),
        message: args.join(' '),
        category: 'console',
        level: 'error'
      });
      originalConsoleError.apply(console, args);
    };

    // Console warn interception
    const originalConsoleWarn = console.warn;
    console.warn = (...args: any[]) => {
      this.addBreadcrumb({
        timestamp: Date.now(),
        message: args.join(' '),
        category: 'console',
        level: 'warning'
      });
      originalConsoleWarn.apply(console, args);
    };
  }

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
  }): string {
    // Apply sampling
    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return '';
    }

    const errorId = generateId();
    
    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp: Date.now(),
      message: errorData.message,
      stack: errorData.stack || (errorData.error ? formatStackTrace(errorData.error) : undefined),
      url: errorData.filename || window.location.href,
      lineno: errorData.lineno,
      colno: errorData.colno,
      filename: errorData.filename,
      userId: this.config.userId || this.userContext.id,
      sessionId: '', // Will be set by Monitor class
      userAgent: navigator.userAgent,
      environment: this.config.environment,
      release: this.config.release,
      tags: errorData.tags,
      extra: errorData.extra,
      breadcrumbs: [...this.breadcrumbs],
      level: errorData.level || 'error'
    };

    // Apply beforeSend filter
    const filteredError = this.config.beforeSend?.(errorEvent) || errorEvent;
    if (!filteredError) return '';

    return errorId;
  }

  captureException(error: Error, options: {
    level?: 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  } = {}): string {
    return this.captureError({
      message: error.message,
      stack: formatStackTrace(error),
      error,
      level: options.level,
      tags: options.tags,
      extra: options.extra
    });
  }

  captureMessage(message: string, options: {
    level?: 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  } = {}): string {
    return this.captureError({
      message,
      level: options.level || 'info',
      tags: options.tags,
      extra: options.extra
    });
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    
    const maxBreadcrumbs = this.config.maxBreadcrumbs || 50;
    if (this.breadcrumbs.length > maxBreadcrumbs) {
      this.breadcrumbs.splice(0, this.breadcrumbs.length - maxBreadcrumbs);
    }
  }

  setUserContext(user: any): void {
    this.userContext = { ...this.userContext, ...user };
  }

  setTags(tags: Record<string, string>): void {
    // Tags will be applied to future errors
  }

  setExtra(extra: Record<string, any>): void {
    // Extra data will be applied to future errors
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}
