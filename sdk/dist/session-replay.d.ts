import type { ReviConfig } from './types';
import { ConsoleLogEntry } from './console-recorder';
import { HeatmapData } from './heatmap-generator';
export interface ReplayEvent {
    type: 'full_snapshot' | 'incremental_snapshot' | 'meta' | 'custom';
    timestamp: number;
    data: any;
}
export interface ConsoleLog {
    timestamp: number;
    level: 'log' | 'info' | 'warn' | 'error' | 'debug';
    args: any[];
    stack?: string;
}
export interface NetworkRequest {
    timestamp: number;
    id: string;
    method: string;
    url: string;
    status?: number;
    duration?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
    failed?: boolean;
}
/**
 * Advanced session replay system with console logs and network requests
 */
export declare class SessionReplayManager {
    private config;
    private domSerializer;
    private consoleRecorder;
    private heatmapGenerator;
    private events;
    private consoleLogs;
    private networkRequests;
    private isRecording;
    private sessionId;
    private startTime;
    private originalConsole;
    private originalFetch;
    private originalXMLHttpRequest;
    constructor(config: ReviConfig, sessionId: string);
    /**
     * Start recording session replay
     */
    startRecording(): void;
    /**
     * Stop recording session replay
     */
    stopRecording(): void;
    /**
     * Get all replay events
     */
    getReplayData(): {
        events: ReplayEvent[];
        console_logs: ConsoleLogEntry[];
        network_requests: NetworkRequest[];
        heatmap_data?: HeatmapData[];
        session_info: {
            session_id: string;
            start_time: number;
            duration: number;
            page_url: string;
        };
        analytics: {
            console_insights: any;
            heatmap_insights?: any;
        };
    };
    /**
     * Clear replay data
     */
    clearReplayData(): void;
    /**
     * Setup basic replay tracking
     */
    private setupReplay;
    /**
     * Take a full DOM snapshot
     */
    private takeFullSnapshot;
    /**
     * Handle DOM changes
     */
    private handleDOMChange;
    /**
     * Add heatmap methods
     */
    renderHeatmap(filter?: ('click' | 'move' | 'scroll')[]): void;
    toggleHeatmap(visible: boolean): void;
    getHeatmapInsights(): any;
    /**
     * Setup network request capture
     */
    private setupNetworkCapture;
    /**
     * Setup mouse and keyboard interaction tracking
     */
    private setupInteractionTracking;
    /**
     * Utility methods
     */
    private addEvent;
    private addCustomEvent;
    private serializeConsoleArgs;
    private generateRequestId;
    private getRequestHeaders;
    private getResponseHeaders;
    private serializeRequestBody;
    private shouldCaptureResponseBody;
    private shouldCaptureXHRResponse;
    private getElementId;
    private shouldIgnoreKeystroke;
    private sanitizeKey;
    private restoreOriginalNetwork;
}
//# sourceMappingURL=session-replay.d.ts.map