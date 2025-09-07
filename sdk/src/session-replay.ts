import type { ReviConfig } from './types';
import { EnhancedDOMSerializer, EnhancedDOMSnapshot, EnhancedDOMChange } from './enhanced-dom-serializer';
import { ConsoleRecorder, ConsoleLogEntry } from './console-recorder';
import { HeatmapGenerator, HeatmapData } from './heatmap-generator';

export interface ReplayEvent {
  type: 'full_snapshot' | 'incremental_snapshot' | 'meta' | 'custom';
  timestamp: number;
  data: any;
}

export interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: any[];
  stack?: string;
}

export interface NetworkRequest {
  timestamp: number;
  id: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  failed?: boolean;
}

/**
 * Advanced session replay system with console logs and network requests
 */
export class SessionReplayManager {
  private config: ReviConfig;
  private domSerializer: EnhancedDOMSerializer;
  private consoleRecorder: ConsoleRecorder;
  private heatmapGenerator: HeatmapGenerator | null = null;
  private events: ReplayEvent[] = [];
  private consoleLogs: ConsoleLog[] = [];
  private networkRequests: Map<string, NetworkRequest> = new Map();
  private isRecording = false;
  private sessionId: string;
  private startTime: number;
  private originalConsole: any = {};
  private originalFetch: any;
  private originalXMLHttpRequest: any;

  constructor(config: ReviConfig, sessionId: string) {
    this.config = config;
    this.sessionId = sessionId;
    this.startTime = Date.now();
    this.domSerializer = new EnhancedDOMSerializer(config);
    this.consoleRecorder = new ConsoleRecorder(sessionId, {
      maxEntries: config.replay?.maxConsoleEntries || 1000,
      captureStackTrace: config.replay?.captureStackTrace !== false,
      serializeObjects: config.replay?.serializeObjects !== false,
      maxObjectDepth: config.replay?.maxObjectDepth || 3,
      maxStringLength: config.replay?.maxStringLength || 10000,
      ignoredLevels: config.replay?.ignoredConsoleLevels || []
    });
    
    if (this.config.replay?.enabled) {
      this.setupReplay();
      
      // Initialize heatmap generator if enabled
      if (this.config.replay?.heatmaps?.enabled && typeof document !== 'undefined') {
        const container = document.body || document.documentElement;
        if (container) {
          this.heatmapGenerator = new HeatmapGenerator(container, {
            radius: config.replay?.heatmaps?.radius || 20,
            maxIntensity: config.replay?.heatmaps?.maxIntensity || 100,
            blur: config.replay?.heatmaps?.blur || 15,
            maxOpacity: config.replay?.heatmaps?.maxOpacity || 0.6
          });
        }
      }
    }
  }

  /**
   * Start recording session replay
   */
  startRecording(): void {
    if (this.isRecording || !this.config.replay?.enabled) return;

    this.isRecording = true;
    
    // Take initial snapshot
    this.takeFullSnapshot();
    
    // Start observing DOM changes
    this.domSerializer.startEnhancedObserving(this.handleDOMChange.bind(this));
    
    // Start console recording
    this.consoleRecorder.start();
    
    // Setup network monitoring
    this.setupNetworkCapture();
    
    // Setup mouse and keyboard tracking
    this.setupInteractionTracking();
    
    // Periodic full snapshots
    setInterval(() => {
      if (this.isRecording) {
        this.takeFullSnapshot();
      }
    }, 60000); // Every minute
    
    if (this.config.debug) {
      console.log('Revi: Session replay started');
    }
  }

  /**
   * Stop recording session replay
   */
  stopRecording(): void {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.domSerializer.stopEnhancedObserving();
    this.consoleRecorder.stop();
    this.restoreOriginalNetwork();
    
    if (this.heatmapGenerator) {
      this.heatmapGenerator.destroy();
      this.heatmapGenerator = null;
    }
    
    if (this.config.debug) {
      console.log('Revi: Session replay stopped');
    }
  }

  /**
   * Get all replay events
   */
  getReplayData(): {
    events: ReplayEvent[];
    console_logs: ConsoleLogEntry[];
    network_requests: NetworkRequest[];
    heatmap_data?: HeatmapData[];
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
  } {
    const consoleEntries = this.consoleRecorder.getEntries();
    const consoleInsights = this.consoleRecorder.generateInsights();
    
    let heatmapData: HeatmapData[] | undefined;
    let heatmapInsights: any;
    
    if (this.heatmapGenerator) {
      const heatmapExport = this.heatmapGenerator.exportData();
      heatmapData = heatmapExport.data;
      heatmapInsights = this.heatmapGenerator.generateInsights();
    }

    return {
      events: [...this.events],
      console_logs: consoleEntries,
      network_requests: Array.from(this.networkRequests.values()),
      heatmap_data: heatmapData,
      session_info: {
        session_id: this.sessionId,
        start_time: this.startTime,
        duration: Date.now() - this.startTime,
        page_url: window.location.href
      },
      analytics: {
        console_insights: consoleInsights,
        heatmap_insights: heatmapInsights
      }
    };
  }

  /**
   * Clear replay data
   */
  clearReplayData(): void {
    this.events = [];
    this.consoleLogs = [];
    this.networkRequests.clear();
    this.consoleRecorder.clear();
    
    if (this.heatmapGenerator) {
      this.heatmapGenerator.clear();
    }
  }

  /**
   * Setup basic replay tracking
   */
  private setupReplay(): void {
    if (typeof window === 'undefined') return;

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.addCustomEvent('visibility_change', {
        hidden: document.hidden
      });
    });

    // Track window focus/blur
    window.addEventListener('focus', () => {
      this.addCustomEvent('window_focus', {});
    });

    window.addEventListener('blur', () => {
      this.addCustomEvent('window_blur', {});
    });

    // Track viewport changes
    window.addEventListener('resize', () => {
      this.addCustomEvent('viewport_change', {
        width: window.innerWidth,
        height: window.innerHeight
      });
    });

    // Track scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Add to heatmap data
        if (this.heatmapGenerator) {
          this.heatmapGenerator.addDataPoint(
            window.scrollX || 0,
            window.scrollY || 0,
            5,
            'scroll'
          );
        }
        
        this.addCustomEvent('scroll', {
          x: window.scrollX,
          y: window.scrollY
        });
      }, 100);
    }, { passive: true });
  }

  /**
   * Take a full DOM snapshot
   */
  private takeFullSnapshot(): void {
    if (!this.isRecording) return;

    try {
      const snapshot = this.domSerializer.takeEnhancedSnapshot();
      
      this.addEvent({
        type: 'full_snapshot',
        timestamp: Date.now(),
        data: snapshot
      });
    } catch (error) {
      if (this.config.debug) {
        console.error('Revi: Failed to take DOM snapshot', error);
      }
    }
  }

  /**
   * Handle DOM changes
   */
  private handleDOMChange(change: EnhancedDOMChange): void {
    if (!this.isRecording) return;

    this.addEvent({
      type: 'incremental_snapshot',
      timestamp: change.timestamp,
      data: {
        source: 'mutation',
        ...change
      }
    });
  }

  /**
   * Add heatmap methods
   */
  renderHeatmap(filter?: ('click' | 'move' | 'scroll')[]): void {
    if (this.heatmapGenerator) {
      this.heatmapGenerator.render(filter);
    }
  }

  toggleHeatmap(visible: boolean): void {
    if (this.heatmapGenerator) {
      if (visible) {
        this.heatmapGenerator.render();
      } else {
        this.heatmapGenerator.clear();
      }
    }
  }

  getHeatmapInsights(): any {
    return this.heatmapGenerator?.generateInsights() || null;
  }

  /**
   * Setup network request capture
   */
  private setupNetworkCapture(): void {
    // Capture fetch requests
    if (typeof window.fetch !== 'undefined') {
      this.originalFetch = window.fetch;
      
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        const url = input instanceof Request ? input.url : input.toString();
        const method = init?.method || (input instanceof Request ? input.method : 'GET');
        
        if (this.isRecording) {
          this.networkRequests.set(requestId, {
            timestamp: startTime,
            id: requestId,
            method,
            url,
            requestHeaders: this.getRequestHeaders(init, input),
            requestBody: await this.serializeRequestBody(init, input)
          });
        }
        
        try {
          const response = await this.originalFetch(input, init);
          const duration = Date.now() - startTime;
          
          if (this.isRecording) {
            const networkRequest = this.networkRequests.get(requestId);
            if (networkRequest) {
              networkRequest.status = response.status;
              networkRequest.duration = duration;
              networkRequest.responseHeaders = this.getResponseHeaders(response);
              
              // Optionally capture response body (be careful with large responses)
              if (this.shouldCaptureResponseBody(response)) {
                try {
                  const clonedResponse = response.clone();
                  networkRequest.responseBody = await clonedResponse.text();
                } catch (e) {
                  // Response body couldn't be captured
                }
              }
            }
          }
          
          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          if (this.isRecording) {
            const networkRequest = this.networkRequests.get(requestId);
            if (networkRequest) {
              networkRequest.duration = duration;
              networkRequest.failed = true;
            }
          }
          
          throw error;
        }
      };
    }

    // Capture XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
      this.originalXMLHttpRequest = XMLHttpRequest;
      
      const self = this;
      
      window.XMLHttpRequest = function() {
        const xhr = new self.originalXMLHttpRequest();
        const requestId = self.generateRequestId();
        let method = 'GET';
        let url = '';
        let startTime = 0;
        
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(m: string, u: string | URL, ...args: any[]) {
          method = m;
          url = u.toString();
          return originalOpen.call(this, m, u, ...args);
        };
        
        xhr.send = function(body?: any) {
          startTime = Date.now();
          
          if (self.isRecording) {
            self.networkRequests.set(requestId, {
              timestamp: startTime,
              id: requestId,
              method,
              url,
              requestBody: body
            });
          }
          
          return originalSend.call(this, body);
        };
        
        xhr.addEventListener('loadend', () => {
          const duration = Date.now() - startTime;
          
          if (self.isRecording) {
            const networkRequest = self.networkRequests.get(requestId);
            if (networkRequest) {
              networkRequest.status = xhr.status;
              networkRequest.duration = duration;
              networkRequest.failed = xhr.status === 0 || xhr.status >= 400;
              
              if (self.shouldCaptureXHRResponse(xhr)) {
                networkRequest.responseBody = xhr.responseText;
              }
            }
          }
        });
        
        return xhr;
      };
    }
  }

  /**
   * Setup mouse and keyboard interaction tracking
   */
  private setupInteractionTracking(): void {
    // Mouse events
    const mouseEvents = ['mousedown', 'mouseup', 'click', 'dblclick', 'mousemove'];
    
    mouseEvents.forEach(eventType => {
      document.addEventListener(eventType, (event: MouseEvent) => {
        if (!this.isRecording) return;
        
        // Throttle mousemove events
        if (eventType === 'mousemove' && Math.random() > 0.1) return;
        
        // Add to heatmap data
        if (this.heatmapGenerator) {
          let intensity = 1;
          if (eventType === 'click') intensity = 10;
          else if (eventType === 'mousemove') intensity = 2;
          else if (eventType === 'mousedown') intensity = 5;
          
          this.heatmapGenerator.addDataPoint(
            event.clientX,
            event.clientY,
            intensity,
            eventType === 'click' ? 'click' : 'move'
          );
        }
        
        this.addEvent({
          type: 'incremental_snapshot',
          timestamp: Date.now(),
          data: {
            source: 'mouse',
            type: eventType,
            x: event.clientX,
            y: event.clientY,
            id: this.getElementId(event.target as Element)
          }
        });
      }, { capture: true, passive: true });
    });

    // Keyboard events
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.isRecording) return;
      
      // Don't capture sensitive keystrokes
      if (this.shouldIgnoreKeystroke(event)) return;
      
      this.addEvent({
        type: 'incremental_snapshot',
        timestamp: Date.now(),
        data: {
          source: 'keyboard',
          type: 'keydown',
          key: this.sanitizeKey(event.key),
          code: event.code,
          id: this.getElementId(event.target as Element)
        }
      });
    }, { capture: true, passive: true });
  }

  /**
   * Utility methods
   */
  private addEvent(event: ReplayEvent): void {
    this.events.push(event);
    
    // Limit event buffer
    if (this.events.length > 10000) {
      this.events = this.events.slice(-8000);
    }
  }

  private addCustomEvent(type: string, data: any): void {
    this.addEvent({
      type: 'custom',
      timestamp: Date.now(),
      data: { type, ...data }
    });
  }

  private serializeConsoleArgs(args: any[]): any[] {
    return args.map(arg => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.parse(JSON.stringify(arg));
        }
        return arg;
      } catch (e) {
        return '[Unserializable Object]';
      }
    });
  }

  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getRequestHeaders(init?: RequestInit, input?: RequestInfo | URL): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, init.headers);
      }
    }
    
    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        headers[key] = value;
      });
    }
    
    return headers;
  }

  private getResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private async serializeRequestBody(init?: RequestInit, input?: RequestInfo | URL): Promise<any> {
    let body = init?.body;
    
    if (input instanceof Request && !body) {
      try {
        body = await input.clone().text();
      } catch (e) {
        return null;
      }
    }
    
    if (!body) return null;
    
    if (typeof body === 'string') {
      return body.length > 10000 ? body.substring(0, 10000) + '...[truncated]' : body;
    }
    
    if (body instanceof FormData) {
      const formData: Record<string, any> = {};
      body.forEach((value, key) => {
        formData[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return formData;
    }
    
    return '[Binary Data]';
  }

  private shouldCaptureResponseBody(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    // Only capture text-based responses under 100KB
    return contentType.includes('application/json') ||
           contentType.includes('text/') ||
           (contentLength > 0 && contentLength < 100000);
  }

  private shouldCaptureXHRResponse(xhr: XMLHttpRequest): boolean {
    const contentType = xhr.getResponseHeader('content-type') || '';
    
    return contentType.includes('application/json') ||
           contentType.includes('text/') ||
           (xhr.responseText && xhr.responseText.length < 100000);
  }

  private getElementId(element: Element | null): number | undefined {
    // This would ideally use the same node ID system as the DOM serializer
    return element ? Math.random() : undefined;
  }

  private shouldIgnoreKeystroke(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    
    if (target && target.tagName) {
      const tagName = target.tagName.toLowerCase();
      const type = (target as HTMLInputElement).type;
      
      // Ignore keystrokes in password fields
      if (tagName === 'input' && type === 'password') return true;
      
      // Ignore keystrokes in elements marked as sensitive
      if (target.hasAttribute('data-revi-ignore')) return true;
    }
    
    return false;
  }

  private sanitizeKey(key: string): string {
    // Don't capture the actual key for sensitive inputs
    if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
      return '*'; // Mask alphanumeric characters
    }
    return key;
  }


  private restoreOriginalNetwork(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    if (this.originalXMLHttpRequest) {
      window.XMLHttpRequest = this.originalXMLHttpRequest;
    }
  }
}