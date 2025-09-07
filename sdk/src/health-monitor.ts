/**
 * API Health Monitoring System
 * Continuous health assessment with adaptive behavior
 */

export interface HealthMetrics {
  responseTime: number[];
  successRate: number;
  errorRate: number;
  availability: number;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  totalErrors: number;
  uptime: number;
  downtime: number;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  endpoint: string;
  method: 'GET' | 'HEAD' | 'POST';
  expectedStatus: number[];
  retryCount: number;
  failureThreshold: number;
  recoveryThreshold: number;
  degradationThreshold: number;
  critical: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: number;
  responseTime?: number;
  error?: string;
  metrics: HealthMetrics;
  trend: 'improving' | 'stable' | 'degrading';
  confidence: number; // 0-1
}

export interface RegionalHealth {
  region: string;
  endpoint: string;
  status: HealthStatus;
  priority: number;
  lastFailover?: number;
}

/**
 * Health Monitor for individual endpoints
 */
export class EndpointHealthMonitor {
  private config: HealthCheckConfig;
  private metrics: HealthMetrics;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(status: HealthStatus) => void> = [];
  private requestHistory: Array<{ timestamp: number; success: boolean; responseTime: number }> = [];
  private windowSize = 60000; // 1 minute window
  private isRunning = false;

  constructor(
    private name: string,
    config: Partial<HealthCheckConfig>
  ) {
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      endpoint: '',
      method: 'HEAD',
      expectedStatus: [200, 204],
      retryCount: 3,
      failureThreshold: 3,
      recoveryThreshold: 3,
      degradationThreshold: 0.1, // 10% error rate
      critical: false,
      ...config
    };

    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): HealthMetrics {
    return {
      responseTime: [],
      successRate: 1.0,
      errorRate: 0.0,
      availability: 1.0,
      lastCheck: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      totalRequests: 0,
      totalErrors: 0,
      uptime: 0,
      downtime: 0
    };
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.scheduleCheck();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private scheduleCheck(): void {
    if (!this.isRunning) return;

    this.checkInterval = setTimeout(async () => {
      await this.performHealthCheck();
      this.scheduleCheck();
    }, this.config.interval);
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let responseTime = 0;
    let error: string | undefined;

    try {
      for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
        try {
          const checkStartTime = Date.now();
          const response = await this.executeHealthCheck();
          responseTime = Date.now() - checkStartTime;

          if (this.config.expectedStatus.includes(response.status)) {
            success = true;
            break;
          } else {
            throw new Error(`Unexpected status code: ${response.status}`);
          }
        } catch (attemptError: any) {
          if (attempt === this.config.retryCount) {
            throw attemptError;
          }
          // Wait before retry with exponential backoff
          await this.sleep(1000 * Math.pow(2, attempt));
        }
      }
    } catch (checkError: any) {
      error = checkError.message;
      responseTime = Date.now() - startTime;
    }

    this.recordCheckResult(success, responseTime, error);
  }

  private async executeHealthCheck(): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.endpoint, {
        method: this.config.method,
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'User-Agent': 'Revi-HealthMonitor/1.0'
        }
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private recordCheckResult(success: boolean, responseTime: number, error?: string): void {
    const timestamp = Date.now();

    // Add to request history
    this.requestHistory.push({ timestamp, success, responseTime });
    this.cleanupOldHistory();

    // Update metrics
    this.updateMetrics(success, responseTime);

    // Update consecutive counters
    if (success) {
      this.metrics.consecutiveFailures = 0;
      this.metrics.consecutiveSuccesses++;
    } else {
      this.metrics.consecutiveSuccesses = 0;
      this.metrics.consecutiveFailures++;
    }

    this.metrics.lastCheck = timestamp;

    // Notify listeners
    const status = this.calculateHealthStatus(error);
    this.notifyListeners(status);
  }

  private cleanupOldHistory(): void {
    const cutoff = Date.now() - this.windowSize;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    
    if (!success) {
      this.metrics.totalErrors++;
    }

    // Update response times
    this.metrics.responseTime.push(responseTime);
    if (this.metrics.responseTime.length > 100) {
      this.metrics.responseTime.shift(); // Keep only last 100 measurements
    }

    // Calculate current window metrics
    const windowRequests = this.requestHistory.length;
    const windowSuccesses = this.requestHistory.filter(r => r.success).length;
    const windowErrors = windowRequests - windowSuccesses;

    this.metrics.successRate = windowRequests > 0 ? windowSuccesses / windowRequests : 1.0;
    this.metrics.errorRate = windowRequests > 0 ? windowErrors / windowRequests : 0.0;

    // Calculate availability (uptime vs downtime)
    const totalTime = this.metrics.totalRequests * this.config.interval;
    const estimatedDowntime = this.metrics.totalErrors * this.config.interval;
    this.metrics.availability = totalTime > 0 ? 1 - (estimatedDowntime / totalTime) : 1.0;

    // Calculate response time percentiles
    if (this.metrics.responseTime.length > 0) {
      const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
      this.metrics.averageResponseTime = sorted.reduce((a, b) => a + b) / sorted.length;
      this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
      this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
    }
  }

  private calculateHealthStatus(error?: string): HealthStatus {
    let status: HealthStatus['status'] = 'unknown';
    let trend: HealthStatus['trend'] = 'stable';
    let confidence = 0.5;

    // Determine status based on consecutive failures and error rate
    if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      status = 'unhealthy';
      confidence = Math.min(0.9, this.metrics.consecutiveFailures / (this.config.failureThreshold * 2));
    } else if (this.metrics.errorRate > this.config.degradationThreshold) {
      status = 'degraded';
      confidence = Math.min(0.8, this.metrics.errorRate * 2);
    } else if (this.metrics.consecutiveSuccesses >= this.config.recoveryThreshold) {
      status = 'healthy';
      confidence = Math.min(0.95, this.metrics.consecutiveSuccesses / (this.config.recoveryThreshold * 2));
    }

    // Determine trend based on recent history
    if (this.requestHistory.length >= 10) {
      const recentHalf = this.requestHistory.slice(-5);
      const earlierHalf = this.requestHistory.slice(-10, -5);
      
      const recentSuccessRate = recentHalf.filter(r => r.success).length / recentHalf.length;
      const earlierSuccessRate = earlierHalf.filter(r => r.success).length / earlierHalf.length;
      
      if (recentSuccessRate > earlierSuccessRate + 0.2) {
        trend = 'improving';
      } else if (recentSuccessRate < earlierSuccessRate - 0.2) {
        trend = 'degrading';
      }
    }

    return {
      status,
      lastChecked: this.metrics.lastCheck,
      responseTime: this.metrics.averageResponseTime,
      error,
      metrics: { ...this.metrics },
      trend,
      confidence
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return this.calculateHealthStatus();
  }

  /**
   * Get current metrics
   */
  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Force a health check
   */
  async forceCheck(): Promise<HealthStatus> {
    await this.performHealthCheck();
    return this.getHealthStatus();
  }

  /**
   * Listen for health status changes
   */
  onStatusChange(callback: (status: HealthStatus) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(status: HealthStatus): void {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error(`Health monitor ${this.name} listener error:`, error);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    const oldInterval = this.config.interval;
    this.config = { ...this.config, ...newConfig };
    
    // Restart if interval changed and monitor is running
    if (this.isRunning && oldInterval !== this.config.interval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.requestHistory = [];
  }
}

/**
 * Multi-Regional Health Monitor
 */
export class MultiRegionalHealthMonitor {
  private regionalMonitors = new Map<string, EndpointHealthMonitor>();
  private primaryRegion: string | null = null;
  private failoverHistory: Array<{ from: string; to: string; timestamp: number; reason: string }> = [];
  private listeners: Array<(event: string, data: any) => void> = [];
  private adaptiveBehavior: AdaptiveBehavior;

  constructor() {
    this.adaptiveBehavior = new AdaptiveBehavior();
  }

  /**
   * Register a regional endpoint
   */
  registerRegion(
    region: string,
    endpoint: string,
    priority: number,
    config?: Partial<HealthCheckConfig>
  ): EndpointHealthMonitor {
    const monitor = new EndpointHealthMonitor(`region-${region}`, {
      endpoint,
      critical: priority === 1,
      ...config
    });

    // Set as primary if it's the highest priority
    if (!this.primaryRegion || priority === 1) {
      this.primaryRegion = region;
    }

    monitor.onStatusChange((status) => {
      this.handleRegionalStatusChange(region, status);
    });

    this.regionalMonitors.set(region, monitor);
    return monitor;
  }

  /**
   * Start monitoring all regions
   */
  startAll(): void {
    this.regionalMonitors.forEach(monitor => monitor.start());
  }

  /**
   * Stop monitoring all regions
   */
  stopAll(): void {
    this.regionalMonitors.forEach(monitor => monitor.stop());
  }

  private handleRegionalStatusChange(region: string, status: HealthStatus): void {
    this.notifyListeners('regional-status-change', { region, status });

    // Check if primary region failed and failover is needed
    if (region === this.primaryRegion && status.status === 'unhealthy') {
      this.performFailover(region, 'primary_unhealthy');
    }

    // Update adaptive behavior
    this.adaptiveBehavior.recordRegionalHealth(region, status);
  }

  private performFailover(fromRegion: string, reason: string): void {
    // Find the best available region
    const availableRegions = Array.from(this.regionalMonitors.entries())
      .filter(([region, monitor]) => 
        region !== fromRegion && 
        monitor.getHealthStatus().status !== 'unhealthy'
      )
      .sort(([, a], [, b]) => {
        const aHealth = a.getHealthStatus();
        const bHealth = b.getHealthStatus();
        
        // Prefer healthy over degraded
        if (aHealth.status === 'healthy' && bHealth.status !== 'healthy') return -1;
        if (bHealth.status === 'healthy' && aHealth.status !== 'healthy') return 1;
        
        // Prefer better response times
        return (aHealth.responseTime || Infinity) - (bHealth.responseTime || Infinity);
      });

    if (availableRegions.length > 0) {
      const [newPrimaryRegion] = availableRegions[0];
      const oldPrimary = this.primaryRegion;
      
      this.primaryRegion = newPrimaryRegion;
      
      this.failoverHistory.push({
        from: fromRegion,
        to: newPrimaryRegion,
        timestamp: Date.now(),
        reason
      });

      this.notifyListeners('failover', {
        from: fromRegion,
        to: newPrimaryRegion,
        reason,
        timestamp: Date.now()
      });

      // Update adaptive behavior
      this.adaptiveBehavior.recordFailover(fromRegion, newPrimaryRegion, reason);
    }
  }

  /**
   * Get current primary region
   */
  getPrimaryRegion(): string | null {
    return this.primaryRegion;
  }

  /**
   * Get health status for all regions
   */
  getAllRegionalHealth(): RegionalHealth[] {
    return Array.from(this.regionalMonitors.entries()).map(([region, monitor]) => ({
      region,
      endpoint: monitor['config'].endpoint,
      status: monitor.getHealthStatus(),
      priority: region === this.primaryRegion ? 1 : 2,
      lastFailover: this.failoverHistory
        .filter(f => f.to === region)
        .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp
    }));
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): typeof this.failoverHistory {
    return [...this.failoverHistory];
  }

  /**
   * Get adaptive behavior recommendations
   */
  getAdaptiveBehaviorRecommendations(): any {
    return this.adaptiveBehavior.getRecommendations();
  }

  /**
   * Force failover to specific region
   */
  forceFailover(toRegion: string, reason: string = 'manual'): void {
    if (this.regionalMonitors.has(toRegion)) {
      this.performFailover(this.primaryRegion || 'unknown', reason);
    }
  }

  /**
   * Listen for health monitor events
   */
  onEvent(callback: (event: string, data: any) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: string, data: any): void {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Multi-regional health monitor listener error:', error);
      }
    });
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): any {
    const allStats = Array.from(this.regionalMonitors.values()).map(monitor => monitor.getStats());
    const avgLatency = allStats.reduce((sum, stats) => sum + stats.averageLatency, 0) / allStats.length;
    const avgErrorRate = allStats.reduce((sum, stats) => sum + stats.errorRate, 0) / allStats.length;

    return {
      regions: this.config.regions.length,
      endpoints: Object.keys(this.config.endpoints).length,
      primaryRegion: this.primaryRegion,
      totalChecks: allStats.reduce((sum, stats) => sum + stats.totalChecks, 0),
      averageLatency: avgLatency || 0,
      averageErrorRate: avgErrorRate || 0,
      failovers: this.failoverHistory.length,
      adaptiveBehavior: this.adaptiveBehavior.getRecommendations()
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.regionalMonitors.forEach(monitor => monitor.resetStats());
    this.failoverHistory = [];
    this.adaptiveBehavior.reset();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.regionalMonitors.forEach(monitor => monitor.destroy());
    this.regionalMonitors.clear();
    this.listeners = [];
  }
}

/**
 * Adaptive Behavior Engine
 */
class AdaptiveBehavior {
  private regionalHealthHistory = new Map<string, HealthStatus[]>();
  private failoverPatterns: Array<{ from: string; to: string; timestamp: number; reason: string }> = [];
  private adaptiveSettings = {
    uploadFrequency: 10000, // Base frequency
    batchSize: 25, // Base batch size
    retryAttempts: 3, // Base retry attempts
    timeoutMultiplier: 1.0 // Base timeout multiplier
  };

  recordRegionalHealth(region: string, status: HealthStatus): void {
    if (!this.regionalHealthHistory.has(region)) {
      this.regionalHealthHistory.set(region, []);
    }
    
    const history = this.regionalHealthHistory.get(region)!;
    history.push(status);
    
    // Keep only last 100 records
    if (history.length > 100) {
      history.shift();
    }
    
    // Update adaptive settings based on health
    this.updateAdaptiveSettings(region, status);
  }

  recordFailover(from: string, to: string, reason: string): void {
    this.failoverPatterns.push({ from, to, timestamp: Date.now(), reason });
    
    // Keep only last 50 failovers
    if (this.failoverPatterns.length > 50) {
      this.failoverPatterns.shift();
    }
  }

  private updateAdaptiveSettings(region: string, status: HealthStatus): void {
    // Adjust upload frequency based on health
    if (status.status === 'unhealthy') {
      this.adaptiveSettings.uploadFrequency = Math.min(this.adaptiveSettings.uploadFrequency * 2, 60000);
    } else if (status.status === 'healthy') {
      this.adaptiveSettings.uploadFrequency = Math.max(this.adaptiveSettings.uploadFrequency * 0.9, 5000);
    }

    // Adjust batch size based on response times
    if (status.responseTime && status.responseTime > 5000) {
      this.adaptiveSettings.batchSize = Math.max(this.adaptiveSettings.batchSize - 5, 5);
    } else if (status.responseTime && status.responseTime < 1000) {
      this.adaptiveSettings.batchSize = Math.min(this.adaptiveSettings.batchSize + 5, 100);
    }

    // Adjust retry attempts based on error rates
    if (status.metrics.errorRate > 0.3) {
      this.adaptiveSettings.retryAttempts = Math.min(this.adaptiveSettings.retryAttempts + 1, 10);
    } else if (status.metrics.errorRate < 0.05) {
      this.adaptiveSettings.retryAttempts = Math.max(this.adaptiveSettings.retryAttempts - 1, 1);
    }
  }

  getRecommendations(): typeof this.adaptiveSettings & { 
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let confidence = 0.7;

    // Add reasoning based on current settings
    if (this.adaptiveSettings.uploadFrequency > 30000) {
      reasoning.push('Reduced upload frequency due to poor API health');
    }
    if (this.adaptiveSettings.batchSize < 15) {
      reasoning.push('Reduced batch size due to slow response times');
    }
    if (this.adaptiveSettings.retryAttempts > 5) {
      reasoning.push('Increased retry attempts due to high error rates');
    }

    // Calculate confidence based on data available
    const totalHealthRecords = Array.from(this.regionalHealthHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    if (totalHealthRecords > 50) {
      confidence = Math.min(0.95, confidence + 0.2);
    }

    return {
      ...this.adaptiveSettings,
      confidence,
      reasoning
    };
  }

  reset(): void {
    this.regionalHealthHistory.clear();
    this.failoverPatterns = [];
    this.adaptiveSettings = {
      uploadFrequency: 10000,
      batchSize: 25,
      retryAttempts: 3,
      timeoutMultiplier: 1.0
    };
  }
}