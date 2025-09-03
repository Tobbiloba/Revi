import type { NetworkEvent, ReviConfig } from './types';
import { TraceManager } from './trace-manager';
export declare class NetworkMonitor {
    private config;
    private events;
    private originalFetch;
    private originalXHROpen;
    private originalXHRSend;
    private traceManager;
    constructor(config: ReviConfig, traceManager?: TraceManager);
    private setupInterceptors;
    private interceptFetch;
    private interceptXHR;
    private serializeRequestBody;
    private extractResponseBody;
    private extractHeaders;
    private extractResponseHeaders;
    private calculateBodySize;
    private calculateResponseSize;
    private shouldCaptureResponseBody;
    private shouldMonitorRequest;
    private captureNetworkEvent;
    getEvents(): NetworkEvent[];
    clearEvents(): void;
    flush(): NetworkEvent[];
    destroy(): void;
}
//# sourceMappingURL=network-monitor.d.ts.map