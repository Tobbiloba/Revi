/**
 * Advanced Retry Manager with sophisticated retry strategies
 * Implements jittered exponential backoff, failure classification, and retry budgets
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterRatio: number;
  timeoutMultiplier: number;
  retryBudget: number;
  enableJitter: boolean;
}

export interface RetryableError {
  statusCode?: number;
  type: 'network' | 'timeout' | 'server' | 'client' | 'unknown';
  message: string;
  retryable: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  timestamp: number;
  error?: RetryableError;
  duration?: number;
}

export interface RetryStats {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  averageDelay: number;
  budgetUsed: number;
  lastSuccess?: number;
  lastFailure?: number;
}

export class RetryManager {
  private config: RetryConfig;
  private retryStats: Map<string, RetryStats> = new Map();
  private retryBudgetUsed = 0;
  private lastBudgetReset = Date.now();
  private budgetResetInterval = 60000; // 1 minute
  private requestDeduplication = new Map<string, Promise<any>>();
  private rateLimitedUntil = 0;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterRatio: 0.1,
      timeoutMultiplier: 1.5,
      retryBudget: 100, // Max retry attempts per minute
      enableJitter: true,
      ...config
    };
  }

  /**
   * Execute operation with advanced retry logic
   */
  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      priority?: 'critical' | 'high' | 'medium' | 'low';
      timeout?: number;
      payloadSize?: number;
      deduplicationKey?: string;
    } = {}
  ): Promise<T> {
    const { priority = 'medium', timeout, payloadSize, deduplicationKey } = options;
    
    // Check deduplication
    if (deduplicationKey && this.requestDeduplication.has(deduplicationKey)) {
      return this.requestDeduplication.get(deduplicationKey);
    }

    // Check retry budget
    this.resetBudgetIfNeeded();
    if (!this.hasBudgetAvailable(priority)) {
      throw new Error('Retry budget exceeded. Operation rate-limited.');
    }

    const stats = this.getOrCreateStats(key);
    const attempts: RetryAttempt[] = [];
    let lastError: RetryableError | undefined;

    // Create deduplication promise if needed
    const executePromise = this.performRetryLoop(key, operation, priority, timeout, payloadSize, attempts, stats);
    
    if (deduplicationKey) {
      this.requestDeduplication.set(deduplicationKey, executePromise);
      
      // Clean up deduplication entry after completion
      executePromise.finally(() => {
        this.requestDeduplication.delete(deduplicationKey);
      });
    }

    return executePromise;
  }

  private async performRetryLoop<T>(
    key: string,
    operation: () => Promise<T>,
    priority: 'critical' | 'high' | 'medium' | 'low',
    timeout: number | undefined,
    payloadSize: number | undefined,
    attempts: RetryAttempt[],
    stats: RetryStats
  ): Promise<T> {
    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      
      try {
        // Check rate limiting
        if (Date.now() < this.rateLimitedUntil) {
          throw this.createRetryableError(429, 'Rate limited', 'server', false, priority);
        }

        // Execute with timeout if specified
        const result = timeout 
          ? await this.executeWithTimeout(operation, timeout * Math.pow(this.config.timeoutMultiplier, attempt))
          : await operation();

        // Success - update stats and return
        stats.totalAttempts++;
        stats.successfulRetries = attempt > 0 ? stats.successfulRetries + 1 : stats.successfulRetries;
        stats.lastSuccess = Date.now();
        
        const attemptRecord: RetryAttempt = {
          attempt: attempt + 1,
          delay: 0,
          timestamp: attemptStart,
          duration: Date.now() - attemptStart
        };
        attempts.push(attemptRecord);

        return result;

      } catch (error: any) {
        const retryableError = this.classifyError(error, priority);
        const attemptRecord: RetryAttempt = {
          attempt: attempt + 1,
          delay: 0,
          timestamp: attemptStart,
          error: retryableError,
          duration: Date.now() - attemptStart
        };
        attempts.push(attemptRecord);

        stats.totalAttempts++;
        stats.lastFailure = Date.now();

        // Handle rate limiting
        if (retryableError.statusCode === 429) {
          this.handleRateLimit(error);
        }

        // Check if we should retry
        if (!this.shouldRetry(retryableError, attempt, priority, payloadSize)) {
          stats.failedRetries++;
          throw error;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, priority, payloadSize);
        attemptRecord.delay = delay;
        
        // Update stats
        const totalDelay = attempts.reduce((sum, att) => sum + att.delay, 0);
        stats.averageDelay = totalDelay / attempts.length;

        // Wait before retry
        if (delay > 0) {
          await this.sleep(delay);
        }

        // Consume retry budget
        this.consumeRetryBudget(priority);
      }
    }

    // All retries exhausted
    stats.failedRetries++;
    throw new Error(`Max retry attempts (${this.config.maxAttempts}) exceeded for ${key}`);
  }

  private executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  private classifyError(error: any, priority: 'critical' | 'high' | 'medium' | 'low'): RetryableError {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return this.createRetryableError(0, error.message, 'network', true, priority);
    }

    // Timeout errors
    if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
      return this.createRetryableError(0, error.message, 'timeout', true, priority);
    }

    // HTTP status code errors
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      
      if (status >= 500) {
        // Server errors - retryable
        return this.createRetryableError(status, error.message, 'server', true, priority);
      } else if (status === 429) {
        // Rate limiting - retryable with backoff
        return this.createRetryableError(status, error.message, 'server', true, priority);
      } else if (status >= 400) {
        // Client errors - mostly not retryable, except specific cases
        const retryable = status === 408 || status === 409 || status === 423 || status === 424;
        return this.createRetryableError(status, error.message, 'client', retryable, priority);
      }
    }

    // Unknown errors - not retryable by default
    return this.createRetryableError(0, error.message || 'Unknown error', 'unknown', false, priority);
  }

  private createRetryableError(
    statusCode: number,
    message: string,
    type: RetryableError['type'],
    retryable: boolean,
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): RetryableError {
    return {
      statusCode,
      message,
      type,
      retryable,
      priority
    };
  }

  private shouldRetry(
    error: RetryableError,
    attempt: number,
    priority: 'critical' | 'high' | 'medium' | 'low',
    payloadSize?: number
  ): boolean {
    // Don't retry if error is not retryable
    if (!error.retryable) {
      return false;
    }

    // Don't retry if we've exceeded max attempts
    if (attempt >= this.config.maxAttempts - 1) {
      return false;
    }

    // Don't retry if no budget available (except for critical priority)
    if (priority !== 'critical' && !this.hasBudgetAvailable(priority)) {
      return false;
    }

    // For large payloads, reduce retry attempts on slow connections
    if (payloadSize && payloadSize > 100000) { // 100KB
      const maxAttemptsForLargePayload = Math.max(2, this.config.maxAttempts - 2);
      if (attempt >= maxAttemptsForLargePayload) {
        return false;
      }
    }

    return true;
  }

  private calculateDelay(
    attempt: number,
    priority: 'critical' | 'high' | 'medium' | 'low',
    payloadSize?: number
  ): number {
    // Base exponential backoff
    let delay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt),
      this.config.maxDelay
    );

    // Priority-based delay adjustment
    const priorityMultipliers = {
      critical: 0.5,
      high: 0.7,
      medium: 1.0,
      low: 1.5
    };
    delay *= priorityMultipliers[priority];

    // Payload size adjustment (larger payloads wait longer)
    if (payloadSize && payloadSize > 50000) { // 50KB
      const sizeMultiplier = Math.min(1 + (payloadSize / 100000), 2); // Max 2x delay
      delay *= sizeMultiplier;
    }

    // Add jitter to prevent thundering herd
    if (this.config.enableJitter) {
      const jitter = delay * this.config.jitterRatio * (Math.random() - 0.5);
      delay += jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  private handleRateLimit(error: any): void {
    // Check for Retry-After header
    const retryAfter = error.headers?.['retry-after'] || error.retryAfter;
    
    if (retryAfter) {
      const retryAfterMs = parseInt(retryAfter) * 1000;
      this.rateLimitedUntil = Date.now() + retryAfterMs;
    } else {
      // Default rate limit backoff
      this.rateLimitedUntil = Date.now() + 60000; // 1 minute
    }
  }

  private resetBudgetIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastBudgetReset > this.budgetResetInterval) {
      this.retryBudgetUsed = 0;
      this.lastBudgetReset = now;
    }
  }

  private hasBudgetAvailable(priority: 'critical' | 'high' | 'medium' | 'low'): boolean {
    // Critical requests always have budget
    if (priority === 'critical') {
      return true;
    }

    // Reserve some budget for high priority requests
    const reservedBudget = priority === 'high' ? this.config.retryBudget * 0.2 : this.config.retryBudget * 0.5;
    
    return this.retryBudgetUsed < (this.config.retryBudget - reservedBudget);
  }

  private consumeRetryBudget(priority: 'critical' | 'high' | 'medium' | 'low'): void {
    // Critical requests don't consume budget
    if (priority !== 'critical') {
      this.retryBudgetUsed++;
      
      // Update stats
      for (const stats of this.retryStats.values()) {
        stats.budgetUsed = this.retryBudgetUsed / this.config.retryBudget;
      }
    }
  }

  private getOrCreateStats(key: string): RetryStats {
    if (!this.retryStats.has(key)) {
      this.retryStats.set(key, {
        totalAttempts: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageDelay: 0,
        budgetUsed: 0
      });
    }
    return this.retryStats.get(key)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics for monitoring
   */
  getStats(key?: string): RetryStats | Map<string, RetryStats> {
    if (key) {
      return this.retryStats.get(key) || this.getOrCreateStats(key);
    }
    return new Map(this.retryStats);
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(key?: string): void {
    if (key) {
      this.retryStats.delete(key);
    } else {
      this.retryStats.clear();
      this.retryBudgetUsed = 0;
      this.lastBudgetReset = Date.now();
      this.requestDeduplication.clear();
    }
  }

  /**
   * Check if currently rate limited
   */
  isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  /**
   * Get remaining retry budget
   */
  getRemainingBudget(): number {
    this.resetBudgetIfNeeded();
    return Math.max(0, this.config.retryBudget - this.retryBudgetUsed);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}