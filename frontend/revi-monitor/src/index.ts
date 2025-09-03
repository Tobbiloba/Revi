export { Monitor } from './monitor';
export type { 
  ReviConfig, 
  ErrorEvent, 
  SessionEvent, 
  NetworkEvent, 
  Breadcrumb, 
  UserContext,
  WebVitals,
  PerformanceEntry 
} from './types';

// Default export for convenience
export { Monitor as default } from './monitor';

// Global initialization helper
declare global {
  interface Window {
    Revi?: any;
  }
}
