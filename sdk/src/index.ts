// Core exports
export { Monitor } from './monitor';
export { ErrorHandler } from './error-handler';
export { SessionManager } from './session';
export { NetworkMonitor } from './network-monitor';
export { DataManager } from './data-manager';
export { DeviceInfoManager, deviceInfoManager } from './device-info-manager';

// Resilience exports
export { RetryManager } from './retry-manager';
export { CircuitBreakerManager } from './circuit-breaker';
export { ResilientStorage } from './resilient-storage';
export { MultiRegionalHealthMonitor } from './health-monitor';
export { IntelligentSyncManager } from './sync-manager';
export { IdempotencyManager } from './idempotency-manager';
export { ResilienceCoordinator } from './resilience-coordinator';

// Type exports
export type { 
  ReviConfig, 
  ErrorEvent, 
  SessionEvent, 
  NetworkEvent, 
  Breadcrumb, 
  UserContext,
  WebVitals,
  PerformanceEntry,
  DeviceInfo
} from './types';

// Lazy-loadable modules
export type { PerformanceMonitor } from './performance-monitor';
export type { SessionReplayManager } from './session-replay';

// Default export for convenience
export { Monitor as default } from './monitor';

// Lazy loading helpers (temporarily disabled for build)
// export const loadPerformanceMonitor = () => import('./performance-monitor').then(m => m.PerformanceMonitor);
// export const loadSessionReplay = () => import('./session-replay').then(m => m.SessionReplayManager);

// Global initialization helper
declare global {
  interface Window {
    Revi?: any;
  }
}
