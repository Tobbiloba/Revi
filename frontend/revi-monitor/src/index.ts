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

// Auto-initialize if global config is present
if (typeof window !== 'undefined' && window.Revi) {
  const config = window.Revi;
  if (config.apiKey) {
    const { Monitor } = require('./monitor');
    window.Revi = new Monitor(config);
  }
}
