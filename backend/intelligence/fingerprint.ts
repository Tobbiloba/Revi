import crypto from 'crypto';

export interface ErrorInput {
  message: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
}

export interface FingerprintResult {
  fingerprint: string;
  patternHash: string;
  normalizedMessage: string;
  normalizedStack: string;
  urlPattern: string;
  title: string;
}

/**
 * Smart error fingerprinting algorithm that groups similar errors together
 */
export class ErrorFingerprinter {
  
  /**
   * Generate fingerprint for an error
   */
  static generateFingerprint(error: ErrorInput): FingerprintResult {
    const normalizedMessage = this.normalizeMessage(error.message);
    const normalizedStack = this.normalizeStackTrace(error.stack_trace || '');
    const urlPattern = this.extractUrlPattern(error.url || '');
    
    // Primary fingerprint - exact match
    const fingerprintData = `${normalizedMessage}|${normalizedStack}|${urlPattern}`;
    const fingerprint = this.hash(fingerprintData);
    
    // Pattern hash - for similar errors (more flexible matching)
    const messagePattern = this.extractMessagePattern(normalizedMessage);
    const stackPattern = this.extractStackPattern(normalizedStack);
    const patternData = `${messagePattern}|${stackPattern}|${urlPattern}`;
    const patternHash = this.hash(patternData);
    
    const title = this.generateTitle(normalizedMessage, urlPattern);
    
    return {
      fingerprint,
      patternHash,
      normalizedMessage,
      normalizedStack,
      urlPattern,
      title
    };
  }
  
  /**
   * Normalize error message by removing dynamic values
   */
  private static normalizeMessage(message: string): string {
    return message
      // Remove file paths and line numbers
      .replace(/\/[^\s]+\.js:\d+:\d+/g, '<file>:<line>:<col>')
      .replace(/at line \d+/g, 'at line <num>')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, '<url>')
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      // Remove numbers that might be IDs or temporary values
      .replace(/\b\d{6,}\b/g, '<id>')
      // Remove quoted strings that might be dynamic
      .replace(/"[^"]*"/g, '"<string>"')
      .replace(/'[^']*'/g, "'<string>'")
      // Remove memory addresses
      .replace(/0x[0-9a-f]+/gi, '<addr>')
      // Trim whitespace
      .trim();
  }
  
  /**
   * Normalize stack trace by removing dynamic elements
   */
  private static normalizeStackTrace(stackTrace: string): string {
    if (!stackTrace) return '';
    
    return stackTrace
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Remove line numbers and column numbers
      .map(line => line.replace(/:\d+:\d+/g, ':<line>:<col>'))
      // Remove file paths, keep only filename
      .map(line => line.replace(/\/[^\s]*\/([^\/\s]+\.js)/g, '<path>/$1'))
      // Remove webpack internal paths
      .map(line => line.replace(/webpack:\/\/\/[^\s]*/g, '<webpack>'))
      // Remove anonymous function markers with IDs
      .map(line => line.replace(/<anonymous>:\d+:\d+/g, '<anonymous>'))
      // Remove eval statements
      .map(line => line.replace(/eval at [^,\s]+/g, 'eval at <func>'))
      // Keep only first 10 lines to focus on relevant stack
      .slice(0, 10)
      .join('\n');
  }
  
  /**
   * Extract URL pattern by removing dynamic segments
   */
  private static extractUrlPattern(url: string): string {
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      return pathname
        // Replace numeric IDs
        .replace(/\/\d+/g, '/<id>')
        // Replace UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/<uuid>')
        // Replace other dynamic segments (assume anything with special chars or long strings)
        .replace(/\/[^\/]{20,}/g, '/<dynamic>')
        // Remove query parameters for pattern matching
        + (urlObj.search ? '?<query>' : '');
    } catch {
      // If URL parsing fails, do basic pattern extraction
      return url
        .replace(/\/\d+/g, '/<id>')
        .replace(/[?&][^=]+=[^&]*/g, '?<param>');
    }
  }
  
  /**
   * Extract message pattern for similarity matching
   */
  private static extractMessagePattern(normalizedMessage: string): string {
    return normalizedMessage
      // Replace remaining numbers with placeholders
      .replace(/\d+/g, '<num>')
      // Replace remaining quoted content
      .replace(/"[^"]*"/g, '"<val>"')
      .replace(/'[^']*'/g, "'<val>'")
      // Replace camelCase variables with generic names
      .replace(/\b[a-z]+[A-Z][a-zA-Z]*\b/g, '<var>')
      // Keep only alphabetic words and common error patterns
      .toLowerCase();
  }
  
  /**
   * Extract stack pattern for similarity matching
   */
  private static extractStackPattern(normalizedStack: string): string {
    if (!normalizedStack) return '';
    
    return normalizedStack
      .split('\n')
      // Extract only function names and file references
      .map(line => {
        const functionMatch = line.match(/at ([^\s(]+)/);
        const fileMatch = line.match(/([^\/\s]+\.js)/);
        return functionMatch && fileMatch ? `${functionMatch[1]}@${fileMatch[1]}` : '';
      })
      .filter(line => line.length > 0)
      .slice(0, 5) // Keep top 5 stack entries
      .join('|');
  }
  
  /**
   * Generate human-readable title for error group
   */
  private static generateTitle(message: string, urlPattern: string): string {
    // Extract the main error type
    const errorTypeMatch = message.match(/^(\w+Error|Error)/);
    const errorType = errorTypeMatch ? errorTypeMatch[0] : 'Error';
    
    // Extract key context from message
    let context = message
      .replace(/^(\w+Error|Error):?\s*/i, '')
      .substring(0, 50)
      .trim();
    
    if (context.length === 50) {
      context += '...';
    }
    
    // Add URL context if available
    const urlContext = urlPattern ? ` in ${urlPattern}` : '';
    
    return `${errorType}: ${context}${urlContext}`;
  }
  
  /**
   * Generate SHA-256 hash
   */
  private static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Calculate similarity between two normalized messages using Levenshtein distance
   */
  static calculateSimilarity(message1: string, message2: string): number {
    const len1 = message1.length;
    const len2 = message2.length;
    
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;
    
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = message1[i - 1] === message2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return 1 - (matrix[len2][len1] / maxLen);
  }
}