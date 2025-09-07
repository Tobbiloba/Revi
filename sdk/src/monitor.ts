import { ErrorHandler } from './error-handler';
import { SessionManager } from './session';
import { NetworkMonitor } from './network-monitor';
import { DataManager } from './data-manager';
import { UserJourneyTracker } from './user-journey';
import { TraceManager } from './trace-manager';
import { SamplingManager } from './sampling-manager';
import { PerformanceMonitor } from './performance-monitor';
import { SessionReplayManager } from './session-replay';
import { deviceInfoManager } from './device-info-manager';
import { isBot } from './utils';
import { getDebugLogger, initDebugLogger } from './debug-logger';
import type { ReviConfig, ErrorEvent, UserContext, DeviceInfo } from './types';

export class Monitor {
  private config: ReviConfig;
  private traceManager!: TraceManager;
  private errorHandler!: ErrorHandler;
  private sessionManager!: SessionManager;
  private networkMonitor!: NetworkMonitor;
  private performanceMonitor!: PerformanceMonitor;
  private dataManager!: DataManager;
  private userJourneyTracker!: UserJourneyTracker;
  private sessionReplayManager!: SessionReplayManager;
  private samplingManager!: SamplingManager;
  private debugLogger = getDebugLogger();
  private deviceInfo: DeviceInfo;
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

    // Initialize debug logger with enhanced debugging
    this.debugLogger = initDebugLogger(
      this.config.debug || false,
      (this.config as any).saveDebugLogs || false
    );

    if (!this.config.apiKey) {
      throw new Error('Revi: API key is required');
    }

    // Initialize device information early
    this.deviceInfo = deviceInfoManager.getDeviceInfo();
    
    if (this.config.debug) {
      console.log('Revi: Device info initialized:', deviceInfoManager.getDeviceSummary());
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
      this.userJourneyTracker = new UserJourneyTracker(this.config, () => this.sessionManager.getSessionId());
      this.sessionReplayManager = new SessionReplayManager(this.config, this.sessionManager.getSessionId());
      this.samplingManager = new SamplingManager(this.config);

      this.setupAdaptiveFlush();
      
      // Start session replay if enabled
      if (this.config.replay?.enabled) {
        this.sessionReplayManager.startRecording();
      }
      
      this.isInitialized = true;

      // Register device information automatically
      this.registerDevice().catch(error => {
        if (this.config.debug) {
          console.error('Revi: Device registration failed:', error);
        }
      });

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
      
      // Get current network and session event counts
      const networkEventCount = this.networkMonitor?.getEvents().length || 0;
      const sessionEventCount = this.sessionManager?.getQueuedEventCount?.() || 0;
      const totalActivityCount = errorCount + networkEventCount + sessionEventCount;
      
      // Base interval: 10 seconds
      let flushInterval = 10000;
      
      // Reduce interval if there's high activity (errors, network, or session events)
      if (totalActivityCount > 0) {
        // More aggressive flushing for high activity
        if (totalActivityCount >= 50) {
          flushInterval = 3000; // 3 seconds for very high activity
        } else if (totalActivityCount >= 20) {
          flushInterval = 5000; // 5 seconds for moderate activity  
        } else if (totalActivityCount >= 5) {
          flushInterval = 7000; // 7 seconds for some activity
        }
      }
      
      // Increase interval if no activity (max: 30 seconds)
      if (totalActivityCount === 0 && timeSinceLastFlush > 15000) {
        flushInterval = Math.min(30000, flushInterval + 5000);
      }
      
      // Special case: if we have many network events, flush sooner to prevent memory buildup
      if (networkEventCount >= 100) {
        flushInterval = Math.min(flushInterval, 5000);
      }
      
      if (timeSinceLastFlush >= flushInterval) {
        this.flush();
        lastFlushTime = now;
        errorCount = 0; // Reset counts after flush
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
        level: options.level || 'error',
        deviceInfo: this.deviceInfo
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
        level: options.level || 'info',
        deviceInfo: this.deviceInfo
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

  // Device information
  getDeviceInfo(): DeviceInfo {
    return this.deviceInfo;
  }

  private async registerDevice(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Check if we've already registered device info for this session
    const sessionId = this.sessionManager.getSessionId();
    const storageKey = `revi_device_registered_${sessionId}`;
    
    try {
      if (typeof sessionStorage !== 'undefined') {
        const alreadyRegistered = sessionStorage.getItem(storageKey);
        if (alreadyRegistered) {
          if (this.config.debug) {
            console.log('Revi: Device already registered for this session, skipping');
          }
          return;
        }
      }
    } catch (e) {
      // Ignore sessionStorage errors, continue with registration
    }

    try {
      const devicePayload = {
        device_info: {
          browser_name: this.deviceInfo.browser_name,
          browser_version: this.deviceInfo.browser_version,
          browser_major_version: this.deviceInfo.browser_major_version,
          os_name: this.deviceInfo.os_name,
          os_version: this.deviceInfo.os_version,
          device_type: this.deviceInfo.device_type,
          device_fingerprint: this.deviceInfo.device_fingerprint,
          screen_resolution: this.deviceInfo.screen_resolution,
          color_depth: this.deviceInfo.color_depth,
          device_pixel_ratio: this.deviceInfo.device_pixel_ratio,
          viewport_size: this.deviceInfo.viewport_size,
          platform: this.deviceInfo.platform,
          language: this.deviceInfo.language,
          timezone: this.deviceInfo.timezone,
          canvas_fingerprint: this.deviceInfo.canvas_fingerprint,
          webgl_fingerprint: this.deviceInfo.webgl_fingerprint,
          cookie_enabled: this.deviceInfo.cookie_enabled,
          local_storage_enabled: this.deviceInfo.local_storage_enabled,
          session_storage_enabled: this.deviceInfo.session_storage_enabled
        },
        session_id: this.sessionManager.getSessionId(),
        user_id: this.config.userId
      };

      const response = await fetch(`${this.config.apiUrl}/api/capture/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(devicePayload)
      });

      if (!response.ok) {
        throw new Error(`Device registration failed: ${response.status}`);
      }

      // Mark as registered for this session
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
        }
      } catch (e) {
        // Ignore sessionStorage errors
      }

      if (this.config.debug) {
        console.log('Revi: Device registered successfully');
      }
    } catch (error) {
      // Don't throw, just log - device registration shouldn't break the SDK
      if (this.config.debug) {
        console.error('Revi: Device registration error:', error);
      }
    }
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
    if (!this.isInitialized) {
      this.debugLogger.log('general', 'flush-skipped', 'Flush called but Monitor not initialized');
      return;
    }

    this.debugLogger.log('general', 'flush-start', 'Starting flush operation');

    // Get all queued events
    const sessionEvents = this.sessionManager.flush();
    const networkEvents = this.networkMonitor.flush();

    this.debugLogger.logDataTransformation(
      'flush-raw-events',
      { sessionEventsCount: sessionEvents.length, networkEventsCount: networkEvents.length },
      { sessionEvents, networkEvents },
      this.sessionManager.getSessionId()
    );

    // CRITICAL: Log session events before modification
    this.debugLogger.log('session', 'session-events-before-sessionid', 'Session events before adding sessionId', {
      count: sessionEvents.length,
      events: sessionEvents.map((event, index) => ({
        index,
        type: event.type,
        hasSessionId: !!(event.sessionId),
        sessionIdValue: event.sessionId || 'MISSING',
        dataKeys: Object.keys(event.data || {}),
        timestamp: event.timestamp
      }))
    });

    const currentSessionId = this.sessionManager.getSessionId();
    this.debugLogger.log('session', 'current-session-id', 'Current session ID from SessionManager', {
      sessionId: currentSessionId,
      sessionIdType: typeof currentSessionId,
      sessionIdLength: currentSessionId ? currentSessionId.length : 0
    });

    // Add session ID to session events
    sessionEvents.forEach((event, index) => {
      const beforeSessionId = event.sessionId;
      event.sessionId = currentSessionId;
      
      this.debugLogger.log('session', 'sessionid-assignment', `Assigning sessionId to event ${index}`, {
        eventIndex: index,
        eventType: event.type,
        beforeSessionId: beforeSessionId || 'MISSING',
        afterSessionId: event.sessionId,
        assignmentWorked: event.sessionId === currentSessionId
      });
    });

    // CRITICAL: Log session events after modification
    this.debugLogger.log('session', 'session-events-after-sessionid', 'Session events after adding sessionId', {
      count: sessionEvents.length,
      events: sessionEvents.map((event, index) => ({
        index,
        type: event.type,
        hasSessionId: !!(event.sessionId),
        sessionIdValue: event.sessionId,
        sessionIdMatches: event.sessionId === currentSessionId,
        dataKeys: Object.keys(event.data || {}),
        timestamp: event.timestamp
      }))
    });

    // Add session ID to network events
    networkEvents.forEach((event, index) => {
      const beforeSessionId = event.sessionId;
      event.sessionId = currentSessionId;
      
      this.debugLogger.log('network', 'network-sessionid-assignment', `Assigning sessionId to network event ${index}`, {
        eventIndex: index,
        beforeSessionId: beforeSessionId || 'MISSING',
        afterSessionId: event.sessionId
      });
    });

    // Queue for upload with detailed logging
    if (sessionEvents.length > 0) {
      this.debugLogger.log('session', 'queue-session-events', 'Queueing session events for upload', {
        count: sessionEvents.length,
        allHaveSessionId: sessionEvents.every(e => !!e.sessionId),
        sessionIds: sessionEvents.map(e => e.sessionId)
      });
      
      this.dataManager.queueSessionEvents(sessionEvents);
    } else {
      this.debugLogger.log('session', 'no-session-events', 'No session events to queue');
    }
    
    if (networkEvents.length > 0) {
      this.debugLogger.log('network', 'queue-network-events', 'Queueing network events for upload', {
        count: networkEvents.length
      });
      
      this.dataManager.queueNetworkEvents(networkEvents);
    } else {
      this.debugLogger.log('network', 'no-network-events', 'No network events to queue');
    }

    this.debugLogger.log('general', 'flush-complete', 'Flush operation completed', {
      sessionEventsQueued: sessionEvents.length,
      networkEventsQueued: networkEvents.length
    });
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
