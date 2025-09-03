import { SessionEvent } from './types';

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  args: any[];
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface ConsoleRecorderConfig {
  maxEntries: number;
  captureStackTrace: boolean;
  serializeObjects: boolean;
  maxObjectDepth: number;
  maxStringLength: number;
  ignoredLevels: string[];
}

export class ConsoleRecorder {
  private originalMethods: Record<string, Function> = {};
  private entries: ConsoleLogEntry[] = [];
  private config: ConsoleRecorderConfig;
  private isRecording = false;
  private sessionId: string;

  constructor(sessionId: string, config: Partial<ConsoleRecorderConfig> = {}) {
    this.sessionId = sessionId;
    this.config = {
      maxEntries: 1000,
      captureStackTrace: true,
      serializeObjects: true,
      maxObjectDepth: 3,
      maxStringLength: 10000,
      ignoredLevels: [],
      ...config
    };
  }

  start(): void {
    if (this.isRecording) return;

    const levels: Array<keyof Console> = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
    
    levels.forEach(level => {
      if (this.config.ignoredLevels.includes(level)) return;
      
      const originalMethod = console[level];
      this.originalMethods[level] = originalMethod;
      
      console[level] = (...args: any[]) => {
        // Call original method first
        originalMethod.apply(console, args);
        
        // Record the log entry
        this.recordEntry(level as ConsoleLogEntry['level'], args);
      };
    });

    this.isRecording = true;
  }

  stop(): void {
    if (!this.isRecording) return;

    // Restore original console methods
    Object.entries(this.originalMethods).forEach(([level, method]) => {
      (console as any)[level] = method;
    });

    this.originalMethods = {};
    this.isRecording = false;
  }

  private recordEntry(level: ConsoleLogEntry['level'], args: any[]): void {
    try {
      const entry: ConsoleLogEntry = {
        id: this.generateId(),
        timestamp: Date.now(),
        level,
        args: this.serializeArgs(args)
      };

      // Capture stack trace for errors and warnings
      if ((level === 'error' || level === 'warn') && this.config.captureStackTrace) {
        const error = new Error();
        if (error.stack) {
          entry.stack = this.cleanStackTrace(error.stack);
        }
      }

      // Add source location if available
      if (level === 'error' && args[0] instanceof Error) {
        const error = args[0] as Error;
        // Try to extract location from error stack
        const stackLines = error.stack?.split('\n') || [];
        const sourceLine = stackLines.find(line => 
          line.includes('.js:') || line.includes('.ts:') || line.includes('.tsx:')
        );
        
        if (sourceLine) {
          const match = sourceLine.match(/([^/]+):(\d+):(\d+)/);
          if (match) {
            entry.url = match[1];
            entry.lineNumber = parseInt(match[2]);
            entry.columnNumber = parseInt(match[3]);
          }
        }
      }

      this.addEntry(entry);
    } catch (error) {
      // Fail silently to avoid infinite loops
      this.originalMethods.warn?.call(console, 'ConsoleRecorder error:', error);
    }
  }

  private serializeArgs(args: any[]): any[] {
    return args.map(arg => this.serializeValue(arg, 0));
  }

  private serializeValue(value: any, depth: number): any {
    if (depth > this.config.maxObjectDepth) {
      return '[Object too deep]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return value.length > this.config.maxStringLength 
        ? value.substring(0, this.config.maxStringLength) + '...'
        : value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: this.config.captureStackTrace ? this.cleanStackTrace(value.stack || '') : undefined
      };
    }

    if (value instanceof Date) {
      return {
        __type: 'Date',
        value: value.toISOString()
      };
    }

    if (value instanceof RegExp) {
      return {
        __type: 'RegExp',
        value: value.toString()
      };
    }

    if (Array.isArray(value)) {
      if (!this.config.serializeObjects) return '[Array]';
      
      return value.slice(0, 100).map(item => this.serializeValue(item, depth + 1));
    }

    if (typeof value === 'object') {
      if (!this.config.serializeObjects) return '[Object]';
      
      try {
        const serialized: Record<string, any> = {};
        const keys = Object.keys(value).slice(0, 50); // Limit keys
        
        for (const key of keys) {
          try {
            serialized[key] = this.serializeValue(value[key], depth + 1);
          } catch {
            serialized[key] = '[Unserializable]';
          }
        }
        
        if (Object.keys(value).length > 50) {
          serialized['...'] = `[${Object.keys(value).length - 50} more keys]`;
        }
        
        return serialized;
      } catch {
        return '[Unserializable Object]';
      }
    }

    return String(value);
  }

  private cleanStackTrace(stack: string): string {
    return stack
      .split('\n')
      .filter(line => 
        !line.includes('console-recorder.ts') && 
        !line.includes('ConsoleRecorder')
      )
      .slice(0, 10) // Limit stack depth
      .join('\n');
  }

  private addEntry(entry: ConsoleLogEntry): void {
    this.entries.push(entry);
    
    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries * 0.8);
    }
  }

  private generateId(): string {
    return `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getEntries(fromTimestamp?: number, toTimestamp?: number): ConsoleLogEntry[] {
    let filtered = this.entries;
    
    if (fromTimestamp) {
      filtered = filtered.filter(entry => entry.timestamp >= fromTimestamp);
    }
    
    if (toTimestamp) {
      filtered = filtered.filter(entry => entry.timestamp <= toTimestamp);
    }
    
    return [...filtered];
  }

  getEntriesByLevel(level: ConsoleLogEntry['level']): ConsoleLogEntry[] {
    return this.entries.filter(entry => entry.level === level);
  }

  clear(): void {
    this.entries = [];
  }

  // Convert console entries to session events format
  toSessionEvents(): SessionEvent[] {
    return this.entries.map(entry => ({
      session_id: this.sessionId,
      event_type: 'console',
      data: {
        level: entry.level,
        args: entry.args,
        stack: entry.stack,
        url: entry.url,
        lineNumber: entry.lineNumber,
        columnNumber: entry.columnNumber,
        consoleId: entry.id
      },
      timestamp: entry.timestamp,
      url: entry.url || window.location.href,
      user_agent: navigator.userAgent
    }));
  }

  // Export for analysis
  exportData(): {
    sessionId: string;
    config: ConsoleRecorderConfig;
    entries: ConsoleLogEntry[];
    stats: {
      totalEntries: number;
      levelCounts: Record<string, number>;
      errorCount: number;
      warningCount: number;
      timeRange: { start: number; end: number };
    };
  } {
    const levelCounts: Record<string, number> = {};
    let minTime = Infinity;
    let maxTime = -Infinity;

    this.entries.forEach(entry => {
      levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
      minTime = Math.min(minTime, entry.timestamp);
      maxTime = Math.max(maxTime, entry.timestamp);
    });

    return {
      sessionId: this.sessionId,
      config: this.config,
      entries: [...this.entries],
      stats: {
        totalEntries: this.entries.length,
        levelCounts,
        errorCount: levelCounts.error || 0,
        warningCount: levelCounts.warn || 0,
        timeRange: {
          start: minTime === Infinity ? 0 : minTime,
          end: maxTime === -Infinity ? 0 : maxTime
        }
      }
    };
  }

  // Generate insights from console logs
  generateInsights(): {
    errorPatterns: Array<{ pattern: string; count: number; examples: ConsoleLogEntry[] }>;
    performanceIssues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; details: string }>;
    recommendations: string[];
  } {
    const errorPatterns = this.findErrorPatterns();
    const performanceIssues = this.detectPerformanceIssues();
    const recommendations = this.generateRecommendations();

    return {
      errorPatterns,
      performanceIssues,
      recommendations
    };
  }

  private findErrorPatterns(): Array<{ pattern: string; count: number; examples: ConsoleLogEntry[] }> {
    const errors = this.entries.filter(entry => entry.level === 'error');
    const patterns: Record<string, ConsoleLogEntry[]> = {};

    errors.forEach(error => {
      let pattern = 'Unknown Error';
      
      if (error.args.length > 0) {
        const firstArg = error.args[0];
        if (typeof firstArg === 'string') {
          // Extract error pattern from message
          pattern = firstArg
            .replace(/\d+/g, 'N') // Replace numbers with N
            .replace(/["'][^"']*["']/g, 'STRING') // Replace strings with STRING
            .replace(/\b\w+@\w+\.\w+/g, 'EMAIL') // Replace emails
            .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
            .substring(0, 100);
        } else if (typeof firstArg === 'object' && firstArg.name) {
          pattern = `${firstArg.name}: ${firstArg.message}`.substring(0, 100);
        }
      }

      if (!patterns[pattern]) {
        patterns[pattern] = [];
      }
      patterns[pattern].push(error);
    });

    return Object.entries(patterns)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10)
      .map(([pattern, examples]) => ({
        pattern,
        count: examples.length,
        examples: examples.slice(0, 3) // Show first 3 examples
      }));
  }

  private detectPerformanceIssues(): Array<{ type: string; severity: 'low' | 'medium' | 'high'; details: string }> {
    const issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; details: string }> = [];
    
    // Check for excessive logging
    const recentEntries = this.entries.filter(entry => 
      entry.timestamp > Date.now() - 60000 // Last minute
    );
    
    if (recentEntries.length > 100) {
      issues.push({
        type: 'Excessive Logging',
        severity: 'medium',
        details: `${recentEntries.length} console entries in the last minute may impact performance`
      });
    }

    // Check for repeated errors
    const errorCounts: Record<string, number> = {};
    this.entries
      .filter(entry => entry.level === 'error')
      .forEach(entry => {
        const key = JSON.stringify(entry.args);
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });

    Object.entries(errorCounts).forEach(([error, count]) => {
      if (count > 10) {
        issues.push({
          type: 'Repeated Error',
          severity: count > 50 ? 'high' : 'medium',
          details: `Same error occurred ${count} times`
        });
      }
    });

    // Check for potential memory leaks (objects not being cleaned up)
    const objectLogs = this.entries.filter(entry => 
      entry.args.some(arg => 
        typeof arg === 'object' && 
        arg !== null && 
        !Array.isArray(arg)
      )
    );
    
    if (objectLogs.length > this.entries.length * 0.5) {
      issues.push({
        type: 'Object Logging',
        severity: 'low',
        details: 'High percentage of object logging may indicate memory leaks'
      });
    }

    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.exportData().stats;

    if (stats.errorCount > 0) {
      recommendations.push(
        `Found ${stats.errorCount} console errors. Review error patterns and fix underlying issues.`
      );
    }

    if (stats.warningCount > stats.errorCount * 2) {
      recommendations.push(
        'High warning-to-error ratio suggests proactive error handling could prevent issues.'
      );
    }

    if (stats.totalEntries > 500) {
      recommendations.push(
        'Consider reducing console logging in production to improve performance.'
      );
    }

    if (stats.levelCounts.debug && stats.levelCounts.debug > 100) {
      recommendations.push(
        'Debug logs should be disabled in production environments.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Console logging patterns look healthy.');
    }

    return recommendations;
  }
}