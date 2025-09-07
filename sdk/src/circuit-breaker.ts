/**
 * Multi-Level Circuit Breaker System
 * Prevents cascade failures and provides graceful degradation
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTime: number;
  successThreshold: number;
  timeout: number;
  maxFailureRate: number;
  windowSize: number;
  minRequests: number;
}

export interface CircuitMetrics {
  requests: number;
  failures: number;
  successes: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  state: CircuitState;
  openTime?: number;
  nextRetryTime?: number;
}

export interface FeatureConfig {
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  fallbackEnabled: boolean;
  gracefulDegradation: boolean;
}

/**
 * Individual Circuit Breaker for a single endpoint/feature
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private metrics: CircuitMetrics;
  private requestWindow: Array<{ timestamp: number; success: boolean; duration: number }> = [];
  private listeners: Array<(state: CircuitState, metrics: CircuitMetrics) => void> = [];

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTime: 60000, // 1 minute
      successThreshold: 3,
      timeout: 30000, // 30 seconds
      maxFailureRate: 0.5, // 50%
      windowSize: 60000, // 1 minute window
      minRequests: 5,
      ...config
    };

    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      failureRate: 0,
      averageResponseTime: 0,
      state: this.state
    };
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() < (this.metrics.nextRetryTime || 0)) {
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN. Next retry: ${new Date(this.metrics.nextRetryTime!)}`);
      }
      
      // Time to try half-open
      this.transitionToHalfOpen();
    }

    // Execute operation
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Circuit breaker timeout: ${this.config.timeout}ms`)), this.config.timeout)
        )
      ]);

      // Success
      const duration = Date.now() - startTime;
      this.recordSuccess(duration);
      return result;

    } catch (error) {
      // Failure
      const duration = Date.now() - startTime;
      this.recordFailure(duration);

      // Try fallback if available
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          // Both primary and fallback failed
          throw error; // Throw original error
        }
      }

      throw error;
    }
  }

  private recordSuccess(duration: number): void {
    const now = Date.now();
    
    this.requestWindow.push({
      timestamp: now,
      success: true,
      duration
    });

    this.cleanupOldRequests();
    this.updateMetrics();

    this.metrics.lastSuccessTime = now;

    // State transitions
    if (this.state === 'half-open') {
      if (this.metrics.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.notifyListeners();
  }

  private recordFailure(duration: number): void {
    const now = Date.now();
    
    this.requestWindow.push({
      timestamp: now,
      success: false,
      duration
    });

    this.cleanupOldRequests();
    this.updateMetrics();

    this.metrics.lastFailureTime = now;

    // State transitions
    if (this.state === 'closed' || this.state === 'half-open') {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    }

    this.notifyListeners();
  }

  private shouldOpen(): boolean {
    // Need minimum requests to make a decision
    if (this.metrics.requests < this.config.minRequests) {
      return false;
    }

    // Check failure threshold (absolute)
    if (this.metrics.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate (percentage)
    if (this.metrics.failureRate >= this.config.maxFailureRate) {
      return true;
    }

    // For half-open state, any failure should open the circuit
    if (this.state === 'half-open') {
      return true;
    }

    return false;
  }

  private transitionToClosed(): void {
    this.state = 'closed';
    this.metrics.state = 'closed';
    this.metrics.openTime = undefined;
    this.metrics.nextRetryTime = undefined;
    
    // Reset failure counters but keep some history
    this.metrics.failures = 0;
    this.metrics.successes = 0;
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.metrics.state = 'open';
    this.metrics.openTime = Date.now();
    this.metrics.nextRetryTime = Date.now() + this.config.recoveryTime;
  }

  private transitionToHalfOpen(): void {
    this.state = 'half-open';
    this.metrics.state = 'half-open';
    this.metrics.successes = 0; // Reset success counter for half-open test
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.requestWindow = this.requestWindow.filter(req => req.timestamp > cutoff);
  }

  private updateMetrics(): void {
    const totalRequests = this.requestWindow.length;
    const successfulRequests = this.requestWindow.filter(req => req.success).length;
    const failedRequests = totalRequests - successfulRequests;

    this.metrics.requests = totalRequests;
    this.metrics.successes = successfulRequests;
    this.metrics.failures = failedRequests;
    this.metrics.failureRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    
    // Calculate average response time
    if (this.requestWindow.length > 0) {
      const totalDuration = this.requestWindow.reduce((sum, req) => sum + req.duration, 0);
      this.metrics.averageResponseTime = totalDuration / this.requestWindow.length;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitMetrics {
    this.cleanupOldRequests();
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force state change (for testing)
   */
  forceState(state: CircuitState): void {
    this.state = state;
    this.metrics.state = state;
    
    if (state === 'open') {
      this.metrics.openTime = Date.now();
      this.metrics.nextRetryTime = Date.now() + this.config.recoveryTime;
    }
    
    this.notifyListeners();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.requestWindow = [];
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      failureRate: 0,
      averageResponseTime: 0,
      state: 'closed'
    };
    this.notifyListeners();
  }

  /**
   * Listen for state changes
   */
  onStateChange(callback: (state: CircuitState, metrics: CircuitMetrics) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.state, { ...this.metrics });
      } catch (error) {
        console.error(`Circuit breaker ${this.name} listener error:`, error);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Multi-Level Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private globalCircuitBreaker: CircuitBreaker;
  private featureConfigs = new Map<string, FeatureConfig>();
  private degradedFeatures = new Set<string>();
  private listeners: Array<(event: string, data: any) => void> = [];

  constructor() {
    // Global circuit breaker with more lenient settings
    this.globalCircuitBreaker = new CircuitBreaker('global', {
      failureThreshold: 20,
      maxFailureRate: 0.8,
      recoveryTime: 30000, // 30 seconds
      minRequests: 10
    });

    this.globalCircuitBreaker.onStateChange((state, metrics) => {
      this.notifyListeners('global-state-change', { state, metrics });
      
      if (state === 'open') {
        this.enableEmergencyMode();
      } else if (state === 'closed') {
        this.disableEmergencyMode();
      }
    });
  }

  /**
   * Register a feature with circuit breaker protection
   */
  registerFeature(
    name: string,
    feature: FeatureConfig,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    this.featureConfigs.set(name, feature);
    
    const circuitBreaker = new CircuitBreaker(name, {
      // Priority-based configuration
      failureThreshold: feature.priority === 'critical' ? 10 : feature.priority === 'high' ? 5 : 3,
      maxFailureRate: feature.priority === 'critical' ? 0.8 : 0.5,
      recoveryTime: feature.priority === 'critical' ? 30000 : 60000,
      ...config
    });

    circuitBreaker.onStateChange((state, metrics) => {
      this.handleFeatureStateChange(name, feature, state, metrics);
    });

    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  /**
   * Execute operation with multi-level protection
   */
  async executeProtected<T>(
    featureName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if feature exists
    if (!this.circuitBreakers.has(featureName)) {
      throw new Error(`Feature ${featureName} not registered with circuit breaker`);
    }

    const featureBreaker = this.circuitBreakers.get(featureName)!;
    const featureConfig = this.featureConfigs.get(featureName)!;

    // Check global circuit breaker first
    if (this.globalCircuitBreaker.getState() === 'open') {
      if (featureConfig.priority !== 'critical') {
        if (fallback) {
          return await fallback();
        }
        throw new Error('Global circuit breaker is OPEN. Only critical features allowed.');
      }
    }

    // Check if feature is degraded
    if (this.degradedFeatures.has(featureName)) {
      if (featureConfig.gracefulDegradation && fallback) {
        return await fallback();
      }
    }

    // Execute through both global and feature-specific circuit breakers
    return await this.globalCircuitBreaker.execute(
      () => featureBreaker.execute(operation, fallback),
      fallback
    );
  }

  private handleFeatureStateChange(
    featureName: string,
    feature: FeatureConfig,
    state: CircuitState,
    metrics: CircuitMetrics
  ): void {
    this.notifyListeners('feature-state-change', { featureName, feature, state, metrics });

    if (state === 'open') {
      // Feature circuit opened
      if (feature.gracefulDegradation) {
        this.degradedFeatures.add(featureName);
        this.notifyListeners('feature-degraded', { featureName, feature });
      }

      // Disable non-critical features if too many are failing
      if (feature.priority !== 'critical') {
        this.evaluateSystemHealth();
      }

    } else if (state === 'closed') {
      // Feature circuit closed
      if (this.degradedFeatures.has(featureName)) {
        this.degradedFeatures.delete(featureName);
        this.notifyListeners('feature-recovered', { featureName, feature });
      }
    }
  }

  private evaluateSystemHealth(): void {
    const totalFeatures = this.circuitBreakers.size;
    const failedFeatures = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.getState() === 'open').length;
    
    const failureRate = failedFeatures / totalFeatures;

    // If too many features are failing, enable progressive degradation
    if (failureRate > 0.3) { // 30% of features failing
      this.enableProgressiveDegradation();
    } else if (failureRate < 0.1) { // Less than 10% failing
      this.disableProgressiveDegradation();
    }
  }

  private enableEmergencyMode(): void {
    this.notifyListeners('emergency-mode-enabled', { timestamp: Date.now() });
    
    // Degrade all non-critical features
    this.featureConfigs.forEach((config, name) => {
      if (config.priority !== 'critical') {
        this.degradedFeatures.add(name);
      }
    });
  }

  private disableEmergencyMode(): void {
    this.notifyListeners('emergency-mode-disabled', { timestamp: Date.now() });
    
    // Re-enable features based on their individual circuit breaker states
    this.degradedFeatures.forEach(featureName => {
      const breaker = this.circuitBreakers.get(featureName);
      if (breaker && breaker.getState() !== 'open') {
        this.degradedFeatures.delete(featureName);
      }
    });
  }

  private enableProgressiveDegradation(): void {
    this.notifyListeners('progressive-degradation-enabled', { timestamp: Date.now() });
    
    // Degrade low priority features first
    this.featureConfigs.forEach((config, name) => {
      if (config.priority === 'low' && config.gracefulDegradation) {
        this.degradedFeatures.add(name);
      }
    });
  }

  private disableProgressiveDegradation(): void {
    this.notifyListeners('progressive-degradation-disabled', { timestamp: Date.now() });
    
    // Re-enable low priority features
    this.featureConfigs.forEach((config, name) => {
      if (config.priority === 'low') {
        const breaker = this.circuitBreakers.get(name);
        if (breaker && breaker.getState() !== 'open') {
          this.degradedFeatures.delete(name);
        }
      }
    });
  }

  /**
   * Get system health overview
   */
  getSystemHealth(): {
    globalState: CircuitState;
    featuresTotal: number;
    featuresHealthy: number;
    featuresFailed: number;
    featuresDegraded: number;
    emergencyMode: boolean;
    progressiveDegradation: boolean;
  } {
    const featuresTotal = this.circuitBreakers.size;
    const featuresFailed = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.getState() === 'open').length;
    const featuresHealthy = featuresTotal - featuresFailed;
    const featuresDegraded = this.degradedFeatures.size;

    return {
      globalState: this.globalCircuitBreaker.getState(),
      featuresTotal,
      featuresHealthy,
      featuresFailed,
      featuresDegraded,
      emergencyMode: this.globalCircuitBreaker.getState() === 'open',
      progressiveDegradation: featuresDegraded > 0
    };
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Map<string, CircuitMetrics> {
    const metrics = new Map<string, CircuitMetrics>();
    
    metrics.set('global', this.globalCircuitBreaker.getMetrics());
    
    this.circuitBreakers.forEach((breaker, name) => {
      metrics.set(name, breaker.getMetrics());
    });

    return metrics;
  }

  /**
   * Get specific circuit breaker
   */
  getCircuitBreaker(featureName: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(featureName);
  }

  /**
   * Check if feature is degraded
   */
  isFeatureDegraded(featureName: string): boolean {
    return this.degradedFeatures.has(featureName);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.globalCircuitBreaker.reset();
    this.circuitBreakers.forEach(breaker => breaker.reset());
    this.degradedFeatures.clear();
  }

  /**
   * Listen for circuit breaker events
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
        console.error(`Circuit breaker manager listener error:`, error);
      }
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  executeWithBreaker<T>(
    featureName: string,
    operation: () => Promise<T>,
    options: {
      priority?: 'critical' | 'high' | 'medium' | 'low';
      region?: string;
      degradeGracefully?: boolean;
      degradedResponse?: any;
    } = {}
  ): Promise<T> {
    const { priority = 'medium', degradeGracefully = false, degradedResponse } = options;
    
    const featureConfig: FeatureConfig = {
      name: featureName,
      priority,
      fallbackEnabled: degradeGracefully,
      gracefulDegradation: degradeGracefully
    };

    const fallback = degradeGracefully ? () => Promise.resolve(degradedResponse) : undefined;
    
    this.registerFeature(featureName, featureConfig);
    const circuitBreaker = this.circuitBreakers.get(featureName);
    
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker for feature '${featureName}' not found`);
    }
    
    return circuitBreaker.execute(operation, fallback);
  }

  /**
   * Update global configuration
   */
  updateGlobalConfig(config: Partial<CircuitBreakerConfig>): void {
    this.globalCircuitBreaker.updateConfig(config);
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): any {
    return {
      global: this.globalCircuitBreaker.getMetrics(),
      features: Object.fromEntries(this.getAllMetrics()),
      systemHealth: this.getSystemHealth(),
      degradedFeatures: Array.from(this.degradedFeatures)
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.resetAll();
  }
}