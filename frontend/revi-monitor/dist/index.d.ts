export { Monitor } from './monitor';
export { ErrorHandler } from './error-handler';
export { SessionManager } from './session';
export { NetworkMonitor } from './network-monitor';
export { DataManager } from './data-manager';
export type { ReviConfig, ErrorEvent, SessionEvent, NetworkEvent, Breadcrumb, UserContext, WebVitals, PerformanceEntry } from './types';
export type { PerformanceMonitor } from './performance-monitor';
export type { SessionReplayManager } from './session-replay';
export { Monitor as default } from './monitor';
declare global {
    interface Window {
        Revi?: any;
    }
}
//# sourceMappingURL=index.d.ts.map