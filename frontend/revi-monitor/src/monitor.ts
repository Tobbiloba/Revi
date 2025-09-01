import { ErrorHandler } from './error-handler';
import { SessionManager } from './session';
import { NetworkMonitor } from './network-monitor';
import { PerformanceMonitor } from './performance-monitor';
import { DataManager } from './data-manager';
import { isBot } from './utils';
import type { ReviConfig, ErrorEvent, UserContext } from './types';

export class Monitor {
  private config: ReviConfig;
  private errorHandler: ErrorHandler;
  private sessionManager: SessionManager;
  private networkMonitor: NetworkMonitor;
  private performanceMonitor: PerformanceMonitor;
  private dataManager: DataManager;
  private isInitialized = false;

  constructor(config: ReviConfig) {
    this.config = {
      apiUrl: 'http://localhost:4000',
      environment: 'production',
      debug: false,
      sampleRate: 1.0,
      sessionSampleRate: 1.0,
      maxBreadcrumbs: 50,
      privacy: {
        maskInputs: true,
        maskPasswords: true,
        maskCreditCards: true
      },
      performance: {
        captureWebVitals: true,
        captureResourceTiming: false,
        captureNavigationTiming: true
      },
      replay: {
        enabled: true,
        maskAllInputs: false,
        maskAllText: false
      },
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Revi: API key is required');
    }

    if (isBot()) {
      if (this.config.debug) {
        console.log('Revi: Bot detected, skipping initialization');
      }
      return;
    }

    this.init();
  }

  private init(): void {
    if (this.isInitialized) return;

    try {
      this.errorHandler = new ErrorHandler(this.config);
      this.sessionManager = new SessionManager(this.config);
      this.networkMonitor = new NetworkMonitor(this.config);
      this.performanceMonitor = new PerformanceMonitor(this.config);
      this.dataManager = new DataManager(this.config);

      this.setupPeriodicFlush();
      this.isInitialized = true;

      if (this.config.debug) {
        console.log('Revi: Initialized successfully');
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Revi: Initialization failed', error);
      }
    }
  }

  private setupPeriodicFlush(): void {
    // Flush data every 10 seconds
    setInterval(() => {
      this.flush();
    }, 10000);
  }

  // Public API methods
  captureException(error: Error, options: {
    level?: 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  } = {}): string {
    if (!this.isInitialized) return '';

    const errorId = this.errorHandler.captureException(error, options);
    if (errorId) {
      // Create error event and queue for upload
      const errorEvent: ErrorEvent = {
        id: errorId,
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        userId: this.config.userId,
        sessionId: this.sessionManager.getSessionId(),
        userAgent: navigator.userAgent,
        environment: this.config.environment,
        release: this.config.release,
        tags: options.tags,
        extra: options.extra,
        breadcrumbs: this.errorHandler.getBreadcrumbs(),
        level: options.level || 'error'
      };

      this.dataManager.queueError(errorEvent);
    }

    return errorId;
  }

  captureMessage(message: string, options: {
    level?: 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  } = {}): string {
    if (!this.isInitialized) return '';

    const errorId = this.errorHandler.captureMessage(message, options);
    if (errorId) {
      const errorEvent: ErrorEvent = {
        id: errorId,
        timestamp: Date.now(),
        message,
        url: window.location.href,
        userId: this.config.userId,
        sessionId: this.sessionManager.getSessionId(),
        userAgent: navigator.userAgent,
        environment: this.config.environment,
        release: this.config.release,
        tags: options.tags,
        extra: options.extra,
        breadcrumbs: this.errorHandler.getBreadcrumbs(),
        level: options.level || 'info'
      };

      this.dataManager.queueError(errorEvent);
    }

    return errorId;
  }

  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'error' | 'warning' | 'info' | 'debug';
    data?: Record<string, any>;
  }): void {
    if (!this.isInitialized) return;

    this.errorHandler.addBreadcrumb({
      timestamp: Date.now(),
      message: breadcrumb.message,
      category: breadcrumb.category || 'manual',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data
    });
  }

  setUserContext(user: UserContext): void {
    if (!this.isInitialized) return;

    this.config.userId = user.id;
    this.errorHandler.setUserContext(user);
  }

  setTags(tags: Record<string, string>): void {
    if (!this.isInitialized) return;
    this.errorHandler.setTags(tags);
  }

  setExtra(extra: Record<string, any>): void {
    if (!this.isInitialized) return;
    this.errorHandler.setExtra(extra);
  }

  // Session management
  getSessionId(): string {
    if (!this.isInitialized) return '';
    return this.sessionManager.getSessionId();
  }

  endSession(): void {
    if (!this.isInitialized) return;
    
    this.flush();
    this.sessionManager.endSession();
  }

  // Performance monitoring
  mark(name: string): void {
    if (!this.isInitialized) return;
    this.performanceMonitor.mark(name);
  }

  measure(name: string, startMark?: string, endMark?: string): number | null {
    if (!this.isInitialized) return null;
    return this.performanceMonitor.measure(name, startMark, endMark);
  }

  getWebVitals() {
    if (!this.isInitialized) return {};
    return this.performanceMonitor.getWebVitals();
  }

  // Data management
  flush(): void {
    if (!this.isInitialized) return;

    // Get all queued events
    const sessionEvents = this.sessionManager.flush();
    const networkEvents = this.networkMonitor.flush();

    // Add session ID to network events
    networkEvents.forEach(event => {
      event.sessionId = this.sessionManager.getSessionId();
    });

    // Queue for upload
    if (sessionEvents.length > 0) {
      this.dataManager.queueSessionEvents(sessionEvents);
    }
    
    if (networkEvents.length > 0) {
      this.dataManager.queueNetworkEvents(networkEvents);
    }
  }

  // Cleanup
  destroy(): void {
    if (!this.isInitialized) return;

    this.flush();
    
    if (this.networkMonitor) {
      this.networkMonitor.destroy();
    }
    
    if (this.dataManager) {
      this.dataManager.destroy();
    }

    this.isInitialized = false;
  }
}
