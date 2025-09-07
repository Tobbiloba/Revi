/**
 * Comprehensive debug logger for Revi SDK
 * Tracks all inputs, outputs, and transformations for debugging
 */

export interface DebugLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'session' | 'network' | 'error' | 'data' | 'api' | 'general';
  operation: string;
  data: any;
  sessionId?: string;
  stackTrace?: string;
}

export class DebugLogger {
  private logs: DebugLogEntry[] = [];
  private isEnabled: boolean = false;
  private saveToFile: boolean = false;
  private maxLogs: number = 1000;

  constructor(enabled: boolean = false, saveToFile: boolean = false) {
    this.isEnabled = enabled;
    this.saveToFile = saveToFile;
    
    if (this.isEnabled) {
      console.log('[Revi Debug] Logger initialized - comprehensive debugging enabled');
      this.log('general', 'debug-logger-init', 'Debug logger initialized', { 
        enabled, 
        saveToFile,
        timestamp: Date.now()
      });
    }
  }

  log(category: DebugLogEntry['category'], operation: string, message: string, data?: any): void {
    if (!this.isEnabled) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level: 'info',
      category,
      operation,
      data: {
        message,
        ...data
      },
      stackTrace: this.getStackTrace()
    };

    this.addLogEntry(entry);
    this.consoleLog(entry);
  }

  logError(category: DebugLogEntry['category'], operation: string, error: Error, data?: any): void {
    if (!this.isEnabled) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level: 'error',
      category,
      operation,
      data: {
        error: error.message,
        stack: error.stack,
        ...data
      },
      stackTrace: error.stack
    };

    this.addLogEntry(entry);
    this.consoleLog(entry);
  }

  logSessionEvent(operation: string, sessionId: string, eventData: any): void {
    this.log('session', operation, `Session event: ${operation}`, {
      sessionId,
      eventData: this.sanitizeData(eventData),
      hasSessionId: !!sessionId
    });
  }

  logApiCall(operation: string, url: string, payload: any, response?: any, error?: Error): void {
    this.log('api', operation, `API call to ${url}`, {
      url,
      payload: this.sanitizeData(payload),
      response: response ? this.sanitizeData(response) : undefined,
      error: error?.message,
      payloadSize: JSON.stringify(payload || {}).length
    });
  }

  logDataTransformation(operation: string, before: any, after: any, sessionId?: string): void {
    this.log('data', operation, `Data transformation: ${operation}`, {
      before: this.sanitizeData(before),
      after: this.sanitizeData(after),
      sessionId,
      beforeType: typeof before,
      afterType: typeof after,
      beforeLength: Array.isArray(before) ? before.length : undefined,
      afterLength: Array.isArray(after) ? after.length : undefined
    });
  }

  // Special method to log the exact session event issue we're debugging
  logSessionEventUpload(events: any[], sessionId: string, payload: any): void {
    this.log('session', 'session-event-upload', 'Preparing session event upload', {
      eventsCount: events.length,
      sessionId,
      eventsStructure: events.map(e => ({
        eventType: e.event_type || e.type,
        hasSessionId: !!(e.session_id || e.sessionId),
        sessionIdValue: e.session_id || e.sessionId || 'MISSING',
        timestamp: e.timestamp,
        dataKeys: Object.keys(e.data || {})
      })),
      payload: {
        session_id: payload.session_id,
        eventsCount: payload.events?.length || 0,
        firstEventHasSessionId: payload.events?.[0]?.session_id ? true : false
      }
    });
  }

  private addLogEntry(entry: DebugLogEntry): void {
    this.logs.push(entry);
    
    // Keep only recent logs to prevent memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Auto-save to file if enabled
    if (this.saveToFile && typeof window !== 'undefined') {
      this.debouncedSave();
    }
  }

  private consoleLog(entry: DebugLogEntry): void {
    const prefix = `[Revi Debug:${entry.category}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    
    switch (entry.level) {
      case 'error':
        console.error(`${prefix} ${timestamp} ${entry.operation}:`, entry.data);
        break;
      case 'warn':
        console.warn(`${prefix} ${timestamp} ${entry.operation}:`, entry.data);
        break;
      case 'debug':
        console.debug(`${prefix} ${timestamp} ${entry.operation}:`, entry.data);
        break;
      default:
        console.log(`${prefix} ${timestamp} ${entry.operation}:`, entry.data);
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    try {
      // Clone and sanitize large objects
      const cloned = JSON.parse(JSON.stringify(data));
      
      // Limit array sizes for logging
      if (Array.isArray(cloned) && cloned.length > 10) {
        return {
          _type: 'array',
          length: cloned.length,
          first5: cloned.slice(0, 5),
          last5: cloned.slice(-5)
        };
      }
      
      return cloned;
    } catch (e) {
      return { _error: 'Could not serialize data', _type: typeof data };
    }
  }

  private getStackTrace(): string {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 6).join('\n') : '';
  }

  // Save logs to downloadable JSON file
  private saveTimer: NodeJS.Timeout | null = null;
  
  private debouncedSave = (): void => {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    
    this.saveTimer = setTimeout(() => {
      this.saveToJsonFile();
    }, 5000); // Save after 5 seconds of inactivity
  };

  saveToJsonFile(): void {
    if (typeof window === 'undefined') return;

    try {
      const logData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        sessionCount: this.logs.filter(l => l.category === 'session').length,
        apiCallCount: this.logs.filter(l => l.category === 'api').length,
        errorCount: this.logs.filter(l => l.level === 'error').length,
        logs: this.logs
      };

      const dataStr = JSON.stringify(logData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `revi-debug-logs-${Date.now()}.json`;
      
      // Auto-download (optional - can be controlled by config)
      // link.click();
      
      console.log('[Revi Debug] Log file ready for download:', link.download);
      
      // Store download link globally for manual download
      (window as any).downloadReviLogs = () => {
        link.click();
        URL.revokeObjectURL(url);
      };
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('[Revi Debug] Failed to save logs to file:', error);
    }
  }

  // Get logs for inspection
  getLogs(category?: DebugLogEntry['category'], operation?: string): DebugLogEntry[] {
    let filtered = this.logs;
    
    if (category) {
      filtered = filtered.filter(l => l.category === category);
    }
    
    if (operation) {
      filtered = filtered.filter(l => l.operation === operation);
    }
    
    return filtered;
  }

  // Get summary of logs
  getSummary(): any {
    const categoryCounts = this.logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const operationCounts = this.logs.reduce((acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLogs: this.logs.length,
      categories: categoryCounts,
      operations: operationCounts,
      errors: this.logs.filter(l => l.level === 'error').length,
      timeRange: this.logs.length > 0 ? {
        start: new Date(this.logs[0].timestamp).toISOString(),
        end: new Date(this.logs[this.logs.length - 1].timestamp).toISOString()
      } : null
    };
  }

  // Clear logs
  clear(): void {
    this.logs = [];
    console.log('[Revi Debug] Logs cleared');
  }

  // Enable/disable logging dynamically
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[Revi Debug] Logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Global debug logger instance
let globalDebugLogger: DebugLogger | null = null;

export function getDebugLogger(): DebugLogger {
  if (!globalDebugLogger) {
    globalDebugLogger = new DebugLogger(false, false);
  }
  return globalDebugLogger;
}

export function initDebugLogger(enabled: boolean, saveToFile: boolean = false): DebugLogger {
  globalDebugLogger = new DebugLogger(enabled, saveToFile);
  
  // Make it available globally for console debugging
  if (typeof window !== 'undefined') {
    (window as any).ReviDebugLogger = globalDebugLogger;
    console.log('[Revi Debug] Debug logger available globally as window.ReviDebugLogger');
  }
  
  return globalDebugLogger;
}