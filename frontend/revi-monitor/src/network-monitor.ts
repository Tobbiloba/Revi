import { generateId } from './utils';
import type { NetworkEvent, ReviConfig } from './types';

export class NetworkMonitor {
  private config: ReviConfig;
  private events: NetworkEvent[] = [];
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send;

  constructor(config: ReviConfig) {
    this.config = config;
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    if (typeof window === 'undefined') return;

    this.interceptFetch();
    this.interceptXHR();
  }

  private interceptFetch(): void {
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const method = (args[1]?.method || 'GET').toUpperCase();
      
      let requestSize = 0;
      let requestBody: any;
      
      if (args[1]?.body) {
        requestBody = this.serializeRequestBody(args[1].body);
        requestSize = this.calculateBodySize(args[1].body);
      }

      try {
        const response = await this.originalFetch.apply(window, args);
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

        this.captureNetworkEvent({
          method,
          url,
          statusCode: response.status,
          responseTime: endTime - startTime,
          requestSize,
          responseSize,
          requestHeaders: this.extractHeaders(args[1]?.headers),
          responseHeaders: this.extractResponseHeaders(response.headers),
          requestBody,
          responseBody,
          timestamp: startTime
        });

        return response;
      } catch (error) {
        const endTime = Date.now();
        
        this.captureNetworkEvent({
          method,
          url,
          statusCode: 0, // Network error
          responseTime: endTime - startTime,
          requestSize,
          responseSize: 0,
          requestHeaders: this.extractHeaders(args[1]?.headers),
          requestBody,
          timestamp: startTime,
          error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    };
  }

  private interceptXHR(): void {
    const self = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string, ...args: any[]) {
      (this as any)._reviData = {
        method: method.toUpperCase(),
        url,
        startTime: Date.now()
      };
      
      return self.originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const reviData = (this as any)._reviData;
      if (!reviData) {
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

    // Auto-flush when buffer is full
    if (this.events.length >= 50) {
      this.flush();
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
    // Restore original implementations
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    XMLHttpRequest.prototype.send = this.originalXHRSend;
  }
}
