import { ErrorHandler } from './error-handler';
import { SessionManager } from './session';
import { NetworkMonitor } from './network-monitor';
import { DataManager } from './data-manager';
import { UserJourneyTracker } from './user-journey';
import { TraceManager } from './trace-manager';
import { SamplingManager } from './sampling-manager';
import { PerformanceMonitor } from './performance-monitor';
import { SessionReplayManager } from './session-replay';
import { isBot } from './utils';
import type { ReviConfig, ErrorEvent, UserContext } from './types';

export class Monitor {
  private config: ReviConfig;
  private traceManager: TraceManager;
  private errorHandler: ErrorHandler;
  private sessionManager: SessionManager;
  private networkMonitor: NetworkMonitor;
  private performanceMonitor: PerformanceMonitor;
  private dataManager: DataManager;
  private userJourneyTracker: UserJourneyTracker;
  private sessionReplayManager: SessionReplayManager;
  private samplingManager: SamplingManager;
  private isInitialized = false;

  constructor(config: ReviConfig) {
    this.config = {
      apiUrl: process.env.REVI_API_URL || 'https://api.revi.dev',
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
      // Create shared trace manager
      this.traceManager = new TraceManager();
      
      // Initialize core components with shared trace manager
      this.errorHandler = new ErrorHandler(this.config, this.traceManager);
      this.sessionManager = new SessionManager(this.config, this.traceManager);
      this.networkMonitor = new NetworkMonitor(this.config, this.traceManager);
      this.performanceMonitor = new PerformanceMonitor(this.config);
      this.dataManager = new DataManager(this.config);
      this.userJourneyTracker = new UserJourneyTracker(this.config);
      this.sessionReplayManager = new SessionReplayManager(this.config, this.sessionManager.getSessionId());
      this.samplingManager = new SamplingManager(this.config);

      this.setupAdaptiveFlush();
      
      // Start session replay if enabled
      if (this.config.replay?.enabled) {
        this.sessionReplayManager.startRecording();
      }
      
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

  private setupAdaptiveFlush(): void {
    let errorCount = 0;
    let lastFlushTime = Date.now();
    
    const adaptiveFlush = () => {
      const now = Date.now();
      const timeSinceLastFlush = now - lastFlushTime;
      
      // Base interval: 10 seconds
      let flushInterval = 10000;
      
      // Reduce interval if there are many errors (max: 3 seconds)
      if (errorCount > 0) {
        flushInterval = Math.max(3000, 10000 - (errorCount * 1000));
      }
      
      // Increase interval if no activity (max: 30 seconds)
      if (errorCount === 0 && timeSinceLastFlush > 15000) {
        flushInterval = Math.min(30000, flushInterval + 5000);
      }
      
      if (timeSinceLastFlush >= flushInterval) {
        this.flush();
        lastFlushTime = now;
        errorCount = 0; // Reset error count after flush
      }
      
      // Schedule next check
      setTimeout(adaptiveFlush, 2000);
    };
    
    // Start the adaptive flush cycle
    adaptiveFlush();
    
    // Track errors for adaptive frequency
    const originalCaptureException = this.captureException.bind(this);
    this.captureException = (error: Error, options = {}) => {
      errorCount++;
      return originalCaptureException(error, options);
    };
  }

  // Public API methods
  captureException(error: Error, options: {
    level?: 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  } = {}): string {
    if (!this.isInitialized) return '';

    // Sampling check - always capture critical errors
    const isCriticalError = options.level === 'error' || !options.level;
    if (!isCriticalError && this.samplingManager.shouldSkipCapture('error')) {
      return ''; // Skip non-critical errors based on sampling
    }

    // Update activity level based on error frequency
    this.samplingManager.incrementErrorFrequency();
    this.samplingManager.updateActivityLevel('high');

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
      
      // Track error in user journey
      if (this.userJourneyTracker) {
        this.userJourneyTracker.trackError(error, {
          level: options.level,
          tags: options.tags,
          extra: options.extra
        });
      }
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
    this.userJourneyTracker.setUserId(user.id || '');
    this.userJourneyTracker.startTracking(user.id);
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

  // Session Replay methods
  startSessionReplay(): void {
    if (!this.isInitialized || !this.sessionReplayManager) return;
    this.sessionReplayManager.startRecording();
  }

  stopSessionReplay(): void {
    if (!this.isInitialized || !this.sessionReplayManager) return;
    this.sessionReplayManager.stopRecording();
  }

  getSessionReplayData() {
    if (!this.isInitialized || !this.sessionReplayManager) return null;
    return this.sessionReplayManager.getReplayData();
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


  // Trace context methods
  getCurrentTraceId(): string | undefined {
    return this.traceManager?.getCurrentTraceId();
  }

  getCurrentSpanId(): string | undefined {
    return this.traceManager?.getCurrentSpanId();
  }

  getTraceContext(): { traceId?: string; spanId?: string; parentSpanId?: string } {
    return this.traceManager?.getTraceContext() || {};
  }

  startSpan(operationName: string): string | undefined {
    return this.traceManager?.startSpan(operationName);
  }

  finishSpan(spanId?: string, data?: Record<string, any>): void {
    this.traceManager?.finishSpan(spanId, data);
  }

  destroy(): void {
    if (!this.isInitialized) return;

    this.flush();
    
    if (this.networkMonitor) {
      this.networkMonitor.destroy();
    }
    
    if (this.dataManager) {
      this.dataManager.destroy();
    }

    if (this.sessionReplayManager) {
      this.sessionReplayManager.stopRecording();
    }

    if (this.userJourneyTracker) {
      this.userJourneyTracker.stopTracking();
    }
    
    // Cleanup trace manager
    if (this.traceManager) {
      this.traceManager.cleanupSpanData();
    }

    this.isInitialized = false;
  }
}
