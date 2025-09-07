/**
 * Resilience Coordinator - Central orchestrator for all resilience components
 * Coordinates retry management, circuit breakers, storage, health monitoring, and idempotency
 */

import { RetryManager, RetryConfig } from './retry-manager';
import { CircuitBreakerManager, CircuitBreakerConfig } from './circuit-breaker';
import { ResilientStorage, ResilientStorageConfig } from './resilient-storage';
import { MultiRegionalHealthMonitor, HealthMonitorConfig } from './health-monitor';
import { IntelligentSyncManager, SyncConfig } from './sync-manager';
import { IdempotencyManager, IdempotencyConfig } from './idempotency-manager';

export interface ResilienceConfig {
  retry: Partial<RetryConfig>;
  circuitBreaker: Partial<CircuitBreakerConfig>;
  storage: Partial<ResilientStorageConfig>;
  healthMonitor: Partial<HealthMonitorConfig>;
  sync: Partial<SyncConfig>;
  idempotency: Partial<IdempotencyConfig>;
  enableAdaptiveBehavior: boolean;
  performanceThresholds: {
    slowRequestMs: number;
    verySlowRequestMs: number;
    highErrorRate: number;
    criticalErrorRate: number;
  };
}

export interface ResilienceStats {
  retry: any;
  circuitBreaker: any;
  storage: any;
  healthMonitor: any;
  sync: any;
  idempotency: any;
  adaptiveBehavior: {
    currentMode: 'normal' | 'degraded' | 'emergency';
    adaptationCount: number;
    lastAdaptation: number;
  };
}

export interface RequestOptions {
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout?: number;
  payloadSize?: number;
  idempotencyKey?: string;
  bypassCache?: boolean;
  feature: string;
  region?: string;
}

export class ResilienceCoordinator {
  private config: ResilienceConfig;
  private retryManager: RetryManager;
  private circuitBreakerManager: CircuitBreakerManager;
  private storage: ResilientStorage;
  private healthMonitor: MultiRegionalHealthMonitor;
  private syncManager: IntelligentSyncManager;
  private idempotencyManager: IdempotencyManager;
  
  private adaptiveBehavior = {
    currentMode: 'normal' as 'normal' | 'degraded' | 'emergency',
    adaptationCount: 0,
    lastAdaptation: 0
  };

  private performanceHistory: Array<{
    timestamp: number;
    duration: number;
    success: boolean;
    feature: string;
  }> = [];

  constructor(config: Partial<ResilienceConfig> = {}) {
    this.config = {
      retry: {},
      circuitBreaker: {},
      storage: {},
      healthMonitor: {},
      sync: {},
      idempotency: {},
      enableAdaptiveBehavior: true,
      performanceThresholds: {
        slowRequestMs: 2000,
        verySlowRequestMs: 5000,
        highErrorRate: 0.1, // 10%
        criticalErrorRate: 0.25 // 25%
      },
      ...config
    };

    // Initialize all resilience components
    this.retryManager = new RetryManager(this.config.retry);
    this.circuitBreakerManager = new CircuitBreakerManager(this.config.circuitBreaker);
    this.storage = new ResilientStorage(this.config.storage);
    this.healthMonitor = new MultiRegionalHealthMonitor(this.config.healthMonitor);
    this.syncManager = new IntelligentSyncManager(this.config.sync);
    this.idempotencyManager = new IdempotencyManager(this.config.idempotency);

    // Set up adaptive behavior monitoring
    if (this.config.enableAdaptiveBehavior) {
      this.startAdaptiveBehaviorMonitoring();
    }
  }

  /**
   * Execute request with full resilience protection
   */
  async executeResilientRequest<T>(
    operation: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    const startTime = Date.now();
    const { feature, priority, idempotencyKey, region } = options;

    try {
      // Check circuit breaker first
      await this.circuitBreakerManager.executeWithBreaker(
        feature,
        async () => {
          // Execute with idempotency protection if key provided
          if (idempotencyKey) {
            return await this.idempotencyManager.executeIdempotent(
              idempotencyKey,
              () => this.executeWithRetryAndHealth(operation, options),
              {
                method: 'POST',
                url: feature,
                priority,
                bypassCache: options.bypassCache
              }
            );
          } else {
            return await this.executeWithRetryAndHealth(operation, options);
          }
        },
        { priority, region }
      );

      // Record successful performance
      this.recordPerformance(startTime, true, feature);

      return await operation();

    } catch (error: any) {
      // Record failed performance
      this.recordPerformance(startTime, false, feature);

      // Check if we should store for later sync
      if (this.shouldStoreForLaterSync(error, priority)) {
        await this.storeForLaterSync(operation, options, error);
      }

      throw error;
    }
  }

  private async executeWithRetryAndHealth<T>(
    operation: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    const { feature, priority, timeout, payloadSize, region } = options;

    // Get health recommendation
    const healthRecommendation = this.healthMonitor.getAdaptiveRecommendation(
      feature,
      region
    );

    // Adapt request based on health status
    const adaptedOptions = this.adaptRequestToHealth(options, healthRecommendation);

    // Execute with retry protection
    return await this.retryManager.executeWithRetry(
      `${feature}:${region || 'default'}`,
      operation,
      {
        priority,
        timeout: adaptedOptions.timeout,
        payloadSize,
        deduplicationKey: adaptedOptions.deduplicationKey
      }
    );
  }

  private adaptRequestToHealth(
    options: RequestOptions,
    healthRecommendation: any
  ): RequestOptions {
    const adapted = { ...options };

    if (healthRecommendation) {
      // Adjust timeout based on health
      if (healthRecommendation.adjustedTimeout) {
        adapted.timeout = healthRecommendation.adjustedTimeout;
      }

      // Add deduplication for unhealthy services
      if (healthRecommendation.useDeduplication && !adapted.idempotencyKey) {
        adapted.idempotencyKey = `auto-dedup:${options.feature}:${Date.now()}`;
      }
    }

    return adapted;
  }

  private shouldStoreForLaterSync(error: any, priority: string): boolean {
    // Don't store critical requests (they should fail fast)
    if (priority === 'critical') {
      return false;
    }

    // Store network errors for later retry
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Store timeout errors
    if (error.message?.includes('timeout')) {
      return true;
    }

    // Store server errors (5xx)
    if (error.status >= 500) {
      return true;
    }

    return false;
  }

  private async storeForLaterSync<T>(
    operation: () => Promise<T>,
    options: RequestOptions,
    error: Error
  ): Promise<void> {
    const requestData = {
      operation: operation.toString(), // Note: This is a simplified approach
      options,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      timestamp: Date.now()
    };

    await this.storage.storeData(
      `failed-request:${options.feature}:${Date.now()}`,
      requestData,
      {
        priority: options.priority,
        compress: true,
        encrypt: false,
        tier: options.priority === 'high' ? 'hot' : 'warm'
      }
    );
  }

  /**
   * Sync failed requests when connectivity is restored
   */
  async syncFailedRequests(): Promise<void> {
    // Get all failed requests from storage
    const failedRequests = await this.storage.getAllDataByPattern('failed-request:*');

    if (failedRequests.length === 0) {
      return;
    }

    // Use intelligent sync manager for optimal batching
    await this.syncManager.performIntelligentSync(
      'failed-requests',
      failedRequests.map(req => ({
        id: req.key,
        data: req.data,
        priority: req.metadata?.priority || 'medium',
        size: JSON.stringify(req.data).length,
        timestamp: req.metadata?.timestamp || Date.now(),
        dependencies: []
      })),
      {
        maxBatchSize: 50,
        timeoutMs: 30000,
        priority: 'high'
      }
    );

    // Clean up successfully synced requests
    for (const request of failedRequests) {
      await this.storage.deleteData(request.key);
    }
  }

  /**
   * Start adaptive behavior monitoring
   */
  private startAdaptiveBehaviorMonitoring(): void {
    setInterval(() => {
      this.evaluateAndAdaptBehavior();
    }, 30000); // Check every 30 seconds
  }

  private evaluateAndAdaptBehavior(): void {
    if (!this.config.enableAdaptiveBehavior) {
      return;
    }

    const recentPerformance = this.getRecentPerformance(300000); // Last 5 minutes
    if (recentPerformance.length === 0) {
      return;
    }

    const errorRate = recentPerformance.filter(p => !p.success).length / recentPerformance.length;
    const averageDuration = recentPerformance.reduce((sum, p) => sum + p.duration, 0) / recentPerformance.length;

    const currentMode = this.adaptiveBehavior.currentMode;
    let newMode: 'normal' | 'degraded' | 'emergency' = 'normal';

    // Determine new mode based on performance
    if (errorRate >= this.config.performanceThresholds.criticalErrorRate) {
      newMode = 'emergency';
    } else if (
      errorRate >= this.config.performanceThresholds.highErrorRate ||
      averageDuration >= this.config.performanceThresholds.verySlowRequestMs
    ) {
      newMode = 'degraded';
    } else if (averageDuration >= this.config.performanceThresholds.slowRequestMs) {
      newMode = 'degraded';
    }

    // Apply mode change if needed
    if (newMode !== currentMode) {
      this.applyAdaptiveBehaviorMode(newMode);
      this.adaptiveBehavior.currentMode = newMode;
      this.adaptiveBehavior.adaptationCount++;
      this.adaptiveBehavior.lastAdaptation = Date.now();
    }
  }

  private applyAdaptiveBehaviorMode(mode: 'normal' | 'degraded' | 'emergency'): void {
    switch (mode) {
      case 'emergency':
        // Emergency mode: Aggressive protection
        this.retryManager.updateConfig({
          maxAttempts: 2,
          baseDelay: 5000,
          retryBudget: 20
        });
        this.circuitBreakerManager.updateGlobalConfig({
          failureThreshold: 3,
          recoveryTimeout: 30000,
          emergencyMode: true
        });
        break;

      case 'degraded':
        // Degraded mode: Reduced retries, increased delays
        this.retryManager.updateConfig({
          maxAttempts: 3,
          baseDelay: 2000,
          retryBudget: 50
        });
        this.circuitBreakerManager.updateGlobalConfig({
          failureThreshold: 5,
          recoveryTimeout: 15000,
          emergencyMode: false
        });
        break;

      case 'normal':
        // Normal mode: Standard settings
        this.retryManager.updateConfig({
          maxAttempts: 5,
          baseDelay: 1000,
          retryBudget: 100
        });
        this.circuitBreakerManager.updateGlobalConfig({
          failureThreshold: 10,
          recoveryTimeout: 10000,
          emergencyMode: false
        });
        break;
    }
  }

  private recordPerformance(startTime: number, success: boolean, feature: string): void {
    const duration = Date.now() - startTime;
    
    this.performanceHistory.push({
      timestamp: Date.now(),
      duration,
      success,
      feature
    });

    // Keep only recent performance data (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.performanceHistory = this.performanceHistory.filter(
      p => p.timestamp > oneHourAgo
    );
  }

  private getRecentPerformance(timeWindowMs: number) {
    const cutoff = Date.now() - timeWindowMs;
    return this.performanceHistory.filter(p => p.timestamp > cutoff);
  }

  /**
   * Get comprehensive resilience statistics
   */
  getStats(): ResilienceStats {
    return {
      retry: this.retryManager.getStats(),
      circuitBreaker: this.circuitBreakerManager.getGlobalStats(),
      storage: this.storage.getStats(),
      healthMonitor: this.healthMonitor.getGlobalStats(),
      sync: this.syncManager.getStats(),
      idempotency: this.idempotencyManager.getStats(),
      adaptiveBehavior: { ...this.adaptiveBehavior }
    };
  }

  /**
   * Reset all statistics (useful for testing)
   */
  resetAllStats(): void {
    this.retryManager.resetStats();
    this.circuitBreakerManager.resetStats();
    this.storage.resetStats();
    this.healthMonitor.resetStats();
    this.syncManager.resetStats();
    this.idempotencyManager.resetStats();
    this.performanceHistory = [];
    this.adaptiveBehavior = {
      currentMode: 'normal',
      adaptationCount: 0,
      lastAdaptation: 0
    };
  }

  /**
   * Update configuration for all components
   */
  updateConfig(newConfig: Partial<ResilienceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.retry) {
      this.retryManager.updateConfig(newConfig.retry);
    }
    if (newConfig.circuitBreaker) {
      this.circuitBreakerManager.updateGlobalConfig(newConfig.circuitBreaker);
    }
    if (newConfig.storage) {
      this.storage.updateConfig(newConfig.storage);
    }
    if (newConfig.healthMonitor) {
      this.healthMonitor.updateConfig(newConfig.healthMonitor);
    }
    if (newConfig.sync) {
      this.syncManager.updateConfig(newConfig.sync);
    }
    if (newConfig.idempotency) {
      this.idempotencyManager.updateConfig(newConfig.idempotency);
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.idempotencyManager.destroy();
    this.healthMonitor.destroy();
    this.syncManager.destroy();
    // Other components don't have destroy methods currently
  }
}