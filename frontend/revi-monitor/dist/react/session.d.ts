import type { SessionEvent, ReviConfig } from './types';
export declare class SessionManager {
    private sessionId;
    private startTime;
    private events;
    private config;
    private storage;
    constructor(config: ReviConfig);
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