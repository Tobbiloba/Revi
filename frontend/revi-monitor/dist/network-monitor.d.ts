import type { NetworkEvent, ReviConfig } from './types';
export declare class NetworkMonitor {
    private config;
    private events;
    private originalFetch;
    private originalXHROpen;
    private originalXHRSend;
    constructor(config: ReviConfig);
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
    private captureNetworkEvent;
    getEvents(): NetworkEvent[];
    clearEvents(): void;
    flush(): NetworkEvent[];
    destroy(): void;
}
//# sourceMappingURL=network-monitor.d.ts.map