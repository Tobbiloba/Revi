// import { generateId } from './utils'; // Unused import
import type { NetworkEvent, ReviConfig } from './types';
import { TraceManager } from './trace-manager';

export class NetworkMonitor {
  private config: ReviConfig;
  private events: NetworkEvent[] = [];
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send;
  private traceManager: TraceManager;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: ReviConfig, traceManager?: TraceManager) {
    this.config = config;
    this.traceManager = traceManager || new TraceManager();
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    
    this.setupInterceptors();
    this.startActivityMonitor();
  }

  private setupInterceptors(): void {
    if (typeof window === 'undefined') return;

    this.interceptFetch();
    this.interceptXHR();
  }

  private startActivityMonitor(): void {
    if (typeof window === 'undefined') return;
    
    // Check for network inactivity every 3 seconds
    this.activityCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivityTime;
      
      // If no activity for 5 seconds and we have events, flush them
      if (timeSinceActivity >= 5000 && this.events.length > 0) {
        if (this.config.debug) {
          console.log('[Revi Debug] Network activity idle, flushing', this.events.length, 'events');
        }
        this.flush();
      }
    }, 3000);
  }

  private recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  private interceptFetch(): void {
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const method = (args[1]?.method || 'GET').toUpperCase();
      
      // Check if this request should be monitored
      if (!this.shouldMonitorRequest(url)) {
        return await this.originalFetch.apply(window, args);
      }
      
      // Record network activity
      this.recordActivity();
      
      // Start a new span for this network request
      const spanId = this.traceManager.startSpan(`http:${method} ${url}`);
      
      // Inject trace headers into the request
      const traceHeaders = this.traceManager.injectTraceHeaders();
      const originalHeaders = args[1]?.headers || {};
      const headers = { ...originalHeaders, ...traceHeaders };
      
      // Update request args with trace headers
      const modifiedArgs: Parameters<typeof fetch> = [
        args[0],
        {
          ...args[1],
          headers: headers
        }
      ];
      
      let requestSize = 0;
      let requestBody: any;
      
      if (args[1]?.body) {
        requestBody = this.serializeRequestBody(args[1].body);
        requestSize = this.calculateBodySize(args[1].body);
      }

      try {
        const response = await this.originalFetch.apply(window, modifiedArgs);
        const endTime = Date.now();
        
        let responseBody: any;
        let responseSize = 0;
        
        if (this.shouldCaptureResponseBody(url)) {
          const clonedResponse = response.clone();
          try {
            responseBody = await this.extractResponseBody(clonedResponse);
            responseSize = this.calculateResponseSize(responseBody);
          } catch {
            // Failed to extract response body
          }
        }

        // Extract trace context from response headers
        const responseTrace = this.traceManager.extractTraceFromHeaders(
          this.extractResponseHeaders(response.headers)
        );
        
        // Correlate with backend trace if available
        if (responseTrace.traceId) {
          this.traceManager.correlateWithBackendTrace(responseTrace.traceId, responseTrace.spanId);
        }
        
        // Finish the span
        this.traceManager.finishSpan(spanId, {
          statusCode: response.status,
          responseTime: endTime - startTime
        });
        
        const traceContext = this.traceManager.getTraceContext();
        
        this.captureNetworkEvent({
          method,
          url,
          statusCode: response.status,
          responseTime: endTime - startTime,
          requestSize,
          responseSize,
          requestHeaders: this.extractHeaders(headers),
          responseHeaders: this.extractResponseHeaders(response.headers),
          requestBody,
          responseBody,
          timestamp: startTime,
          traceId: traceContext.traceId,
          spanId: spanId,
          parentSpanId: traceContext.parentSpanId
        });

        return response;
      } catch (error) {
        const endTime = Date.now();
        
        // Finish the span with error
        this.traceManager.finishSpan(spanId, {
          statusCode: 0,
          responseTime: endTime - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
        
        const traceContext = this.traceManager.getTraceContext();
        
        this.captureNetworkEvent({
          method,
          url,
          statusCode: 0, // Network error
          responseTime: endTime - startTime,
          requestSize,
          responseSize: 0,
          requestHeaders: this.extractHeaders(headers),
          requestBody,
          timestamp: startTime,
          traceId: traceContext.traceId,
          spanId: spanId,
          parentSpanId: traceContext.parentSpanId
        });

        throw error;
      }
    };
  }

  private interceptXHR(): void {
    const self = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string, ...args: any[]) {
      const shouldMonitor = self.shouldMonitorRequest(url);
      (this as any)._reviData = {
        method: method.toUpperCase(),
        url,
        startTime: Date.now(),
        shouldMonitor
      };
      
      // Record network activity if we're monitoring this request
      if (shouldMonitor) {
        self.recordActivity();
      }
      
      return self.originalXHROpen.call(this, method, url, ...(args as [boolean?, string?, string?]));
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const reviData = (this as any)._reviData;
      if (!reviData || !reviData.shouldMonitor) {
        return self.originalXHRSend.call(this, body);
      }

      reviData.requestBody = self.serializeRequestBody(body);
      reviData.requestSize = self.calculateBodySize(body);

      this.addEventListener('loadend', () => {
        const endTime = Date.now();
        
        let responseBody: any;
        try {
          if (this.responseType === '' || this.responseType === 'text') {
            responseBody = this.responseText;
          } else if (this.responseType === 'json') {
            responseBody = this.response;
          }
        } catch {
          // Failed to extract response
        }

        self.captureNetworkEvent({
          method: reviData.method,
          url: reviData.url,
          statusCode: this.status,
          responseTime: endTime - reviData.startTime,
          requestSize: reviData.requestSize,
          responseSize: self.calculateResponseSize(responseBody),
          requestBody: reviData.requestBody,
          responseBody: self.shouldCaptureResponseBody(reviData.url) ? responseBody : undefined,
          timestamp: reviData.startTime
        });
      });

      return self.originalXHRSend.call(this, body);
    };
  }

  private serializeRequestBody(body: any): any {
    if (!body) return undefined;
    
    if (typeof body === 'string') return body;
    if (body instanceof FormData) {
      const formObject: Record<string, any> = {};
      body.forEach((value, key) => {
        formObject[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return formObject;
    }
    if (body instanceof URLSearchParams) {
      return Object.fromEntries(body);
    }
    
    try {
      return JSON.parse(JSON.stringify(body));
    } catch {
      return '[Unserializable]';
    }
  }

  private async extractResponseBody(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return await response.text();
    }
    
    return '[Binary Data]';
  }

  private extractHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    
    if (headers instanceof Headers) {
      const headerObj: Record<string, string> = {};
      headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      return headerObj;
    }
    
    if (Array.isArray(headers)) {
      const headerObj: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        headerObj[key] = value;
      });
      return headerObj;
    }
    
    return headers as Record<string, string>;
  }

  private extractResponseHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return headerObj;
  }

  private calculateBodySize(body: any): number {
    if (!body) return 0;
    
    if (typeof body === 'string') return body.length;
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (body instanceof Blob) return body.size;
    
    try {
      return JSON.stringify(body).length;
    } catch {
      return 0;
    }
  }

  private calculateResponseSize(response: any): number {
    if (!response) return 0;
    
    try {
      return JSON.stringify(response).length;
    } catch {
      return 0;
    }
  }

  private shouldCaptureResponseBody(url: string): boolean {
    // Only capture response bodies for specific URLs to avoid memory issues
    const allowedPatterns = [
      /\/api\//,
      /\/graphql/,
    ];
    
    return allowedPatterns.some(pattern => pattern.test(url));
  }

  private shouldMonitorRequest(url: string): boolean {
    // Debug logging to identify filtering issues
    if (this.config.debug) {
      console.log('[Revi Debug] Network filter check:', { url });
    }
    
    // PRIORITY 1: Don't monitor the SDK's own API calls to prevent feedback loops
    const apiUrl = this.config.apiUrl || 'https://api.revi.dev';
    const normalizedApiUrl = apiUrl.replace(/\/$/, '');
    const normalizedUrl = url.replace(/\/$/, '');
    
    // Filter requests to Revi's backend API (exact URL match)
    if (normalizedUrl.startsWith(normalizedApiUrl)) {
      if (this.config.debug) {
        console.log('[Revi Debug] Filtering Revi API URL (exact match):', url, '(prevents feedback loop)');
      }
      return false;
    }
    
    // Also filter localhost variants that might not match exactly
    if (url.includes('127.0.0.1:4000') || url.includes('localhost:4000')) {
      if (this.config.debug) {
        console.log('[Revi Debug] Filtering localhost Revi API:', url, '(prevents feedback loop)');
      }
      return false;
    }
    
    // PRIORITY 2: Filter all /api/analytics/ requests regardless of host (catches user journey events)
    if (url.includes('/api/analytics/')) {
      if (this.config.debug) {
        console.log('[Revi Debug] Filtering analytics API:', url, '(prevents user journey feedback loop)');
      }
      return false;
    }
    
    // PRIORITY 3: Filter other specific Revi API endpoints to prevent loops
    const reviApiPatterns = [
      /\/api\/capture\//,
      /\/api\/errors/,
      /\/api\/session/,
      /\/api\/projects/,
      /\/api\/database/,
      /\/health$/,
    ];
    
    // Only filter if it's a Revi API pattern AND from our backend
    const isReviApiPattern = reviApiPatterns.some(pattern => pattern.test(url));
    const isFromReviBackend = normalizedUrl.includes(normalizedApiUrl.replace(/^https?:\/\//, ''));
    
    if (isReviApiPattern && isFromReviBackend) {
      if (this.config.debug) {
        console.log('[Revi Debug] Filtering Revi API endpoint:', url, '(prevents feedback loop)');
      }
      return false;
    }
    
    // PRIORITY 3: Check user-configured exclude URLs
    if (this.config.excludeUrls) {
      const excluded = this.config.excludeUrls.some(pattern => pattern.test(url));
      if (excluded) {
        if (this.config.debug) {
          console.log('[Revi Debug] Filtering user-excluded URL:', url);
        }
        return false;
      }
    }
    
    // PRIORITY 4: Check privacy configuration
    if (this.config.privacy?.denyUrls) {
      const denied = this.config.privacy.denyUrls.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(url);
      });
      if (denied) {
        if (this.config.debug) {
          console.log('[Revi Debug] Filtering privacy-denied URL:', url);
        }
        return false;
      }
    }
    
    // PRIORITY 5: If allowUrls is configured, only allow those
    if (this.config.privacy?.allowUrls) {
      const allowed = this.config.privacy.allowUrls.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(url);
      });
      if (this.config.debug) {
        console.log('[Revi Debug] Allow list result for:', url, '- allowed:', allowed);
      }
      return allowed;
    }
    
    // DEFAULT: Allow all other requests (images, external APIs, same-origin requests, etc.)
    if (this.config.debug) {
      console.log('[Revi Debug] Monitoring URL:', url, '(no exclusion filters matched)');
    }
    return true;
  }

  private captureNetworkEvent(data: Partial<NetworkEvent> & { method: string; url: string; timestamp: number }): void {
    const event: NetworkEvent = {
      sessionId: '', // Will be set by Monitor class
      timestamp: data.timestamp,
      method: data.method,
      url: data.url,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      requestSize: data.requestSize,
      responseSize: data.responseSize,
      requestHeaders: data.requestHeaders,
      responseHeaders: data.responseHeaders,
      requestBody: data.requestBody,
      responseBody: data.responseBody
    };

    this.events.push(event);

    // Auto-flush when buffer is full - increased from 50 to 200 for better batching
    if (this.events.length >= 200) {
      this.flush();
    } else {
      // During rapid activity (< 2 seconds since last activity), delay auto-flush
      // to allow larger batches to accumulate
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      if (timeSinceActivity < 2000 && this.events.length >= 10) {
        // We have at least 10 events and we're in rapid activity mode
        // Let the activity monitor handle flushing instead of auto-flushing now
        if (this.config.debug) {
          console.log('[Revi Debug] Network rapid activity detected, delaying flush for larger batch');
        }
      }
    }
  }

  getEvents(): NetworkEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  flush(): NetworkEvent[] {
    const events = this.getEvents();
    this.clearEvents();
    return events;
  }

  destroy(): void {
    // Clean up activity monitor
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    
    // Restore original implementations
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    XMLHttpRequest.prototype.send = this.originalXHRSend;
  }
}
