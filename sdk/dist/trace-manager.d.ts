export declare class TraceManager {
    private currentTraceId?;
    private currentSpanId?;
    private spanCounter;
    constructor();
    generateNewTrace(): string;
    startSpan(operationName?: string): string;
    finishSpan(spanId?: string, data?: Record<string, any>): void;
    getCurrentTraceId(): string | undefined;
    getCurrentSpanId(): string | undefined;
    getTraceContext(): {
        traceId?: string;
        spanId?: string;
        parentSpanId?: string;
    };
    extractTraceFromHeaders(headers: Record<string, string>): {
        traceId?: string;
        spanId?: string;
    };
    injectTraceHeaders(): Record<string, string>;
    correlateWithBackendTrace(backendTraceId?: string, backendSpanId?: string): void;
    private generateTraceId;
    private generateSpanId;
    private generateRandomHex;
    private getParentSpanId;
    private spanData;
    private setSpanData;
    private getSpanData;
    cleanupSpanData(): void;
}
//# sourceMappingURL=trace-manager.d.ts.map