/**
 * Idempotency and Request Deduplication Manager
 * Ensures safe retries and prevents duplicate operations across the resilience system
 */

export interface IdempotencyConfig {
  keyTTL: number; // How long to remember idempotency keys (ms)
  maxConcurrentRequests: number; // Max concurrent requests for same key
  enableResponseCaching: boolean; // Cache successful responses
  responseCacheTTL: number; // How long to cache responses (ms)
  enableRequestFingerprinting: boolean; // Generate fingerprints for complex requests
  maxStoredKeys: number; // Maximum number of keys to store in memory
}

export interface RequestFingerprint {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyHash?: string;
  timestamp: number;
}

export interface IdempotentRequest {
  key: string;
  fingerprint: RequestFingerprint;
  status: 'pending' | 'completed' | 'failed';
  promise?: Promise<any>;
  response?: any;
  error?: Error;
  attempts: number;
  createdAt: number;
  lastAttemptAt: number;
  completedAt?: number;
}

export interface DeduplicationStats {
  totalRequests: number;
  deduplicatedRequests: number;
  cacheHits: number;
  activePendingRequests: number;
  memoryUsage: number;
  keyCleanups: number;
}

export class IdempotencyManager {
  private config: IdempotencyConfig;
  private requestMap = new Map<string, IdempotentRequest>();
  private responseCache = new Map<string, { response: any; cachedAt: number }>();
  private pendingRequests = new Map<string, Promise<any>>();
  private keyCleanupInterval: NodeJS.Timeout | null = null;
  private stats: DeduplicationStats = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    cacheHits: 0,
    activePendingRequests: 0,
    memoryUsage: 0,
    keyCleanups: 0
  };

  constructor(config: Partial<IdempotencyConfig> = {}) {
    this.config = {
      keyTTL: 300000, // 5 minutes
      maxConcurrentRequests: 10,
      enableResponseCaching: true,
      responseCacheTTL: 60000, // 1 minute
      enableRequestFingerprinting: true,
      maxStoredKeys: 1000,
      ...config
    };

    this.startKeyCleanup();
  }

  /**
   * Execute request with idempotency protection
   */
  async executeIdempotent<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: any;
      bypassCache?: boolean;
      priority?: 'critical' | 'high' | 'medium' | 'low';
    } = {}
  ): Promise<T> {
    this.stats.totalRequests++;

    // Generate request fingerprint if enabled
    const fingerprint = this.config.enableRequestFingerprinting
      ? await this.generateRequestFingerprint(options)
      : null;

    // Check for existing cached response
    if (!options.bypassCache && this.config.enableResponseCaching) {
      const cachedResponse = this.getCachedResponse(key);
      if (cachedResponse) {
        this.stats.cacheHits++;
        return cachedResponse;
      }
    }

    // Check for existing pending request
    const existingRequest = this.requestMap.get(key);
    if (existingRequest && existingRequest.status === 'pending') {
      this.stats.deduplicatedRequests++;
      
      // Wait for existing request to complete
      if (existingRequest.promise) {
        try {
          return await existingRequest.promise;
        } catch (error) {
          // If existing request failed, allow this one to proceed
          if (existingRequest.attempts < 3) {
            // Update existing request for retry
            existingRequest.attempts++;
            existingRequest.lastAttemptAt = Date.now();
          } else {
            // Too many attempts, create new request
            this.requestMap.delete(key);
          }
        }
      }
    }

    // Create new idempotent request
    const idempotentRequest: IdempotentRequest = {
      key,
      fingerprint: fingerprint || {
        method: options.method || 'unknown',
        url: options.url || 'unknown',
        headers: options.headers || {},
        timestamp: Date.now()
      },
      status: 'pending',
      attempts: 1,
      createdAt: Date.now(),
      lastAttemptAt: Date.now()
    };

    // Check concurrent request limits
    const pendingCount = Array.from(this.requestMap.values())
      .filter(req => req.status === 'pending').length;
    
    if (pendingCount >= this.config.maxConcurrentRequests) {
      throw new Error(`Too many concurrent idempotent requests (${pendingCount}/${this.config.maxConcurrentRequests})`);
    }

    // Execute the operation with proper cleanup
    const executePromise = this.performIdempotentOperation(key, operation, idempotentRequest);
    idempotentRequest.promise = executePromise;
    
    this.requestMap.set(key, idempotentRequest);
    this.pendingRequests.set(key, executePromise);
    this.updateStats();

    try {
      const result = await executePromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
      this.updateStats();
    }
  }

  private async performIdempotentOperation<T>(
    key: string,
    operation: () => Promise<T>,
    request: IdempotentRequest
  ): Promise<T> {
    try {
      const result = await operation();
      
      // Mark request as completed
      request.status = 'completed';
      request.response = result;
      request.completedAt = Date.now();

      // Cache successful response if enabled
      if (this.config.enableResponseCaching) {
        this.cacheResponse(key, result);
      }

      return result;

    } catch (error: any) {
      // Mark request as failed
      request.status = 'failed';
      request.error = error;
      request.completedAt = Date.now();

      // Don't cache failed responses
      throw error;
    }
  }

  /**
   * Generate request fingerprint for complex deduplication
   */
  private async generateRequestFingerprint(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<RequestFingerprint> {
    const fingerprint: RequestFingerprint = {
      method: options.method || 'GET',
      url: options.url || '',
      headers: this.normalizeHeaders(options.headers || {}),
      timestamp: Date.now()
    };

    // Generate body hash for POST/PUT requests
    if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
      fingerprint.bodyHash = await this.hashRequestBody(options.body);
    }

    return fingerprint;
  }

  private normalizeHeaders(headers: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    
    // Only include headers that affect request semantics
    const importantHeaders = ['content-type', 'accept', 'authorization'];
    
    for (const [key, value] of Object.entries(headers)) {
      const normalizedKey = key.toLowerCase();
      if (importantHeaders.includes(normalizedKey)) {
        normalized[normalizedKey] = value;
      }
    }

    return normalized;
  }

  private async hashRequestBody(body: any): Promise<string> {
    try {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      
      // Simple hash function for browser compatibility
      let hash = 0;
      for (let i = 0; i < bodyString.length; i++) {
        const char = bodyString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(16);
    } catch (error) {
      return 'hash-error';
    }
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse<T>(key: string): T | null {
    if (!this.config.enableResponseCaching) {
      return null;
    }

    const cached = this.responseCache.get(key);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.cachedAt;
    if (age > this.config.responseCacheTTL) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.response;
  }

  /**
   * Cache successful response
   */
  private cacheResponse(key: string, response: any): void {
    if (!this.config.enableResponseCaching) {
      return;
    }

    this.responseCache.set(key, {
      response,
      cachedAt: Date.now()
    });

    // Prevent unbounded cache growth
    if (this.responseCache.size > this.config.maxStoredKeys) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }
  }

  /**
   * Generate idempotency key from request data
   */
  generateIdempotencyKey(
    method: string,
    url: string,
    body?: any,
    userContext?: string
  ): string {
    const components = [
      method.toUpperCase(),
      url,
      userContext || 'anonymous'
    ];

    if (body) {
      try {
        const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        components.push(bodyString);
      } catch (error) {
        components.push('body-serialize-error');
      }
    }

    return components.join('|');
  }

  /**
   * Check if request is currently pending
   */
  isPending(key: string): boolean {
    const request = this.requestMap.get(key);
    return request?.status === 'pending' || false;
  }

  /**
   * Get request information
   */
  getRequestInfo(key: string): IdempotentRequest | null {
    return this.requestMap.get(key) || null;
  }

  /**
   * Cancel pending request
   */
  cancelRequest(key: string): boolean {
    const request = this.requestMap.get(key);
    if (request && request.status === 'pending') {
      request.status = 'failed';
      request.error = new Error('Request cancelled');
      request.completedAt = Date.now();
      
      this.pendingRequests.delete(key);
      this.updateStats();
      return true;
    }
    return false;
  }

  /**
   * Clear expired entries and manage memory
   */
  private startKeyCleanup(): void {
    this.keyCleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 30000); // Clean up every 30 seconds
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up expired requests
    for (const [key, request] of this.requestMap.entries()) {
      const age = now - request.createdAt;
      if (age > this.config.keyTTL || request.status !== 'pending') {
        this.requestMap.delete(key);
        cleanedCount++;
      }
    }

    // Clean up expired cached responses
    for (const [key, cached] of this.responseCache.entries()) {
      const age = now - cached.cachedAt;
      if (age > this.config.responseCacheTTL) {
        this.responseCache.delete(key);
        cleanedCount++;
      }
    }

    // Enforce memory limits
    if (this.requestMap.size > this.config.maxStoredKeys) {
      const excess = this.requestMap.size - this.config.maxStoredKeys;
      const oldestKeys = Array.from(this.requestMap.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .slice(0, excess)
        .map(([key]) => key);

      for (const key of oldestKeys) {
        this.requestMap.delete(key);
        cleanedCount++;
      }
    }

    this.stats.keyCleanups += cleanedCount;
    this.updateStats();
  }

  private updateStats(): void {
    this.stats.activePendingRequests = this.pendingRequests.size;
    this.stats.memoryUsage = this.requestMap.size + this.responseCache.size;
  }

  /**
   * Get deduplication statistics
   */
  getStats(): DeduplicationStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0,
      activePendingRequests: 0,
      memoryUsage: 0,
      keyCleanups: 0
    };
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.requestMap.clear();
    this.responseCache.clear();
    this.pendingRequests.clear();
    this.resetStats();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IdempotencyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.keyCleanupInterval) {
      clearInterval(this.keyCleanupInterval);
      this.keyCleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Utility functions for common idempotency patterns
 */
export class IdempotencyUtils {
  /**
   * Generate idempotency key for error reporting
   */
  static errorReportingKey(
    projectId: string,
    errorHash: string,
    sessionId: string,
    timestamp?: number
  ): string {
    const timeWindow = timestamp ? Math.floor(timestamp / 60000) * 60000 : 0; // 1-minute windows
    return `error:${projectId}:${errorHash}:${sessionId}:${timeWindow}`;
  }

  /**
   * Generate idempotency key for session events
   */
  static sessionEventKey(
    projectId: string,
    sessionId: string,
    eventType: string,
    sequence: number
  ): string {
    return `session:${projectId}:${sessionId}:${eventType}:${sequence}`;
  }

  /**
   * Generate idempotency key for network events
   */
  static networkEventKey(
    projectId: string,
    sessionId: string,
    method: string,
    url: string,
    timestamp: number
  ): string {
    return `network:${projectId}:${sessionId}:${method}:${url}:${timestamp}`;
  }

  /**
   * Generate idempotency key for batch operations
   */
  static batchOperationKey(
    operation: string,
    batchId: string,
    checksum: string
  ): string {
    return `batch:${operation}:${batchId}:${checksum}`;
  }
}