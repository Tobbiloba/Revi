import type { ReviConfig } from './types';

export class SamplingManager {
  private config: ReviConfig;
  private activityLevel = 0;
  private lastActivity = Date.now();
  private errorFrequency = 0;
  private performanceImpact = 0;
  
  constructor(config: ReviConfig) {
    this.config = config;
    this.startPerformanceMonitoring();
  }

  private startPerformanceMonitoring(): void {
    // Monitor performance impact and adjust sampling
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        this.assessPerformanceImpact();
      }, 5000);
    }
  }

  private assessPerformanceImpact(): void {
    if (typeof performance === 'undefined') return;
    
    try {
      // Simple heuristic: if long tasks are frequent, reduce sampling
      const now = performance.now();
      const entries = performance.getEntriesByType('longtask');
      const recentLongTasks = entries.filter(entry => 
        (now - entry.startTime) < 10000
      );
      
      // Higher impact = more aggressive sampling reduction
      this.performanceImpact = Math.min(recentLongTasks.length / 5, 1);
    } catch (error) {
      // Fallback to low impact if performance API fails
      this.performanceImpact = 0.1;
    }
  }

  updateActivityLevel(activity: 'high' | 'medium' | 'low' | 'idle'): void {
    const levels = { high: 1, medium: 0.7, low: 0.4, idle: 0.1 };
    this.activityLevel = levels[activity];
    this.lastActivity = Date.now();
  }

  incrementErrorFrequency(): void {
    this.errorFrequency = Math.min(this.errorFrequency + 0.1, 1);
    
    // Decay error frequency over time
    setTimeout(() => {
      this.errorFrequency = Math.max(this.errorFrequency - 0.05, 0);
    }, 30000);
  }

  shouldSampleError(): boolean {
    const baseSampleRate = this.config.sampling?.errorSampleRate ?? 1.0;
    
    // Always sample errors if error rate is high
    if (this.errorFrequency > 0.5) {
      return Math.random() < baseSampleRate;
    }
    
    // Reduce sampling if performance impact is high
    const adjustedRate = baseSampleRate * (1 - this.performanceImpact * 0.5);
    
    return Math.random() < adjustedRate;
  }

  shouldSampleSession(): boolean {
    const baseSampleRate = this.config.sampling?.sessionSampleRate ?? this.config.sessionSampleRate ?? 1.0;
    
    // Increase sampling during high activity
    const activityBonus = this.activityLevel * 0.2;
    const adjustedRate = Math.min(baseSampleRate + activityBonus, 1.0);
    
    // Reduce sampling if performance impact is high
    const finalRate = adjustedRate * (1 - this.performanceImpact * 0.3);
    
    return Math.random() < finalRate;
  }

  shouldSamplePerformance(): boolean {
    const baseSampleRate = this.config.sampling?.performanceSampleRate ?? 0.1;
    
    // Reduce performance sampling during high load
    const adjustedRate = baseSampleRate * (1 - this.performanceImpact * 0.7);
    
    return Math.random() < adjustedRate;
  }

  shouldSampleNetwork(): boolean {
    const baseSampleRate = this.config.sampling?.networkSampleRate ?? 0.5;
    
    // Sample less during idle periods
    const idleTimeDays = (Date.now() - this.lastActivity) / (1000 * 60);
    const idlePenalty = idleTimeDays > 5 ? 0.5 : 1.0;
    
    const adjustedRate = baseSampleRate * idlePenalty * (1 - this.performanceImpact * 0.4);
    
    return Math.random() < adjustedRate;
  }

  shouldSampleReplay(): boolean {
    const baseSampleRate = this.config.sampling?.replaySampleRate ?? 0.1;
    
    // Increase replay sampling when there are errors
    const errorBonus = this.errorFrequency * 0.3;
    let adjustedRate = Math.min(baseSampleRate + errorBonus, 1.0);
    
    // Heavy penalty for performance impact since replay is expensive
    adjustedRate = adjustedRate * (1 - this.performanceImpact * 0.8);
    
    return Math.random() < adjustedRate;
  }

  getAdaptiveBatchSize(baseSize: number): number {
    // Reduce batch sizes during high performance impact
    const impactReduction = this.performanceImpact * 0.6;
    return Math.max(Math.floor(baseSize * (1 - impactReduction)), 1);
  }

  getAdaptiveUploadDelay(baseDelay: number): number {
    // Increase delays during high performance impact
    const impactMultiplier = 1 + (this.performanceImpact * 2);
    
    // Decrease delays during high error frequency
    const errorMultiplier = Math.max(0.3, 1 - (this.errorFrequency * 0.7));
    
    return Math.floor(baseDelay * impactMultiplier * errorMultiplier);
  }

  shouldSkipCapture(eventType: 'error' | 'session' | 'performance' | 'network' | 'replay'): boolean {
    switch (eventType) {
      case 'error':
        return !this.shouldSampleError();
      case 'session':
        return !this.shouldSampleSession();
      case 'performance':
        return !this.shouldSamplePerformance();
      case 'network':
        return !this.shouldSampleNetwork();
      case 'replay':
        return !this.shouldSampleReplay();
      default:
        return false;
    }
  }

  getPerformanceImpact(): number {
    return this.performanceImpact;
  }

  getActivityLevel(): number {
    return this.activityLevel;
  }

  getErrorFrequency(): number {
    return this.errorFrequency;
  }
}