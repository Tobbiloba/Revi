import type { SessionEvent, ReviConfig } from './types';
import { TraceManager } from './trace-manager';
export declare class SessionManager {
    private sessionId;
    private startTime;
    private events;
    private config;
    private storage;
    private traceManager?;
    constructor(config: ReviConfig, traceManager?: TraceManager);
    private getOrCreateSessionId;
    getSessionId(): string;
    private setupEventListeners;
    private serializeDOMEvent;
    private shouldMaskInput;
    private shouldMaskText;
    private trackPageLoad;
    captureEvent(type: string, data: Record<string, any>): void;
    getEvents(): SessionEvent[];
    clearEvents(): void;
    flush(): SessionEvent[];
    endSession(): void;
}
//# sourceMappingURL=session.d.ts.map