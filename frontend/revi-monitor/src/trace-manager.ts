export class TraceManager {
  private currentTraceId?: string;
  private currentSpanId?: string;
  private spanCounter = 0;

  constructor() {
    // Initialize with session-level trace ID if needed
    this.generateNewTrace();
  }

  generateNewTrace(): string {
    this.currentTraceId = this.generateTraceId();
    this.currentSpanId = undefined;
    this.spanCounter = 0;
    return this.currentTraceId;
  }

  startSpan(operationName?: string): string {
    const parentSpanId = this.currentSpanId;
    this.currentSpanId = this.generateSpanId();
    this.spanCounter++;
    
    // Store span context for later correlation
    if (operationName) {
      this.setSpanData(operationName, { 
        parentSpanId,
        operationName,
        startTime: Date.now()
      });
    }

    return this.currentSpanId;
  }

  finishSpan(spanId?: string, data?: Record<string, any>): void {
    if (spanId && this.currentSpanId === spanId) {
      // Mark span as finished
      if (data) {
        this.setSpanData(spanId, { 
          ...this.getSpanData(spanId),
          ...data,
          endTime: Date.now()
        });
      }
    }
  }

  getCurrentTraceId(): string | undefined {
    return this.currentTraceId;
  }

  getCurrentSpanId(): string | undefined {
    return this.currentSpanId;
  }

  getTraceContext(): { traceId?: string; spanId?: string; parentSpanId?: string } {
    return {
      traceId: this.currentTraceId,
      spanId: this.currentSpanId,
      parentSpanId: this.getParentSpanId()
    };
  }

  // Extract trace ID from headers (for network requests)
  extractTraceFromHeaders(headers: Record<string, string>): { traceId?: string; spanId?: string } {
    // Support various tracing standards
    const traceId = headers['x-trace-id'] || 
                   headers['traceparent']?.split('-')[1] ||
                   headers['b3-traceid'] ||
                   headers['uber-trace-id']?.split(':')[0];

    const spanId = headers['x-span-id'] || 
                  headers['traceparent']?.split('-')[2] ||
                  headers['b3-spanid'] ||
                  headers['uber-trace-id']?.split(':')[1];

    return { traceId, spanId };
  }

  // Inject trace headers for outgoing requests
  injectTraceHeaders(): Record<string, string> {
    if (!this.currentTraceId) {
      return {};
    }

    const headers: Record<string, string> = {};
    
    // Add custom headers
    headers['x-trace-id'] = this.currentTraceId;
    if (this.currentSpanId) {
      headers['x-span-id'] = this.currentSpanId;
      headers['x-parent-span-id'] = this.getParentSpanId() || '';
    }

    // Add W3C Trace Context (traceparent header)
    if (this.currentSpanId) {
      headers['traceparent'] = `00-${this.currentTraceId}-${this.currentSpanId}-01`;
    }

    return headers;
  }

  // Correlate with backend trace (when available)
  correlateWithBackendTrace(backendTraceId?: string, backendSpanId?: string): void {
    if (backendTraceId) {
      this.currentTraceId = backendTraceId;
    }
    if (backendSpanId) {
      this.currentSpanId = backendSpanId;
    }
  }

  private generateTraceId(): string {
    // Generate 128-bit trace ID (32 hex characters)
    return this.generateRandomHex(32);
  }

  private generateSpanId(): string {
    // Generate 64-bit span ID (16 hex characters)
    return this.generateRandomHex(16);
  }

  private generateRandomHex(length: number): string {
    const array = new Uint8Array(length / 2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private getParentSpanId(): string | undefined {
    // This would typically track a span stack, simplified for now
    return this.spanData.get(this.currentSpanId || '')?.parentSpanId;
  }

  private spanData = new Map<string, any>();

  private setSpanData(spanId: string, data: any): void {
    this.spanData.set(spanId, data);
  }

  private getSpanData(spanId: string): any {
    return this.spanData.get(spanId) || {};
  }

  // Clean up old span data to prevent memory leaks
  cleanupSpanData(): void {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    for (const [spanId, data] of this.spanData.entries()) {
      if (data.endTime && data.endTime < cutoff) {
        this.spanData.delete(spanId);
      }
    }
  }
}