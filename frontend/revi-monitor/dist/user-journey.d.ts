import type { ReviConfig } from './types';
export interface JourneyEvent {
    event_type: 'page_view' | 'click' | 'form_submit' | 'api_call' | 'error';
    url: string;
    referrer?: string;
    timestamp: number;
    duration_ms?: number;
    metadata: Record<string, any>;
}
export interface DeviceFingerprint {
    screen_resolution: string;
    color_depth: number;
    timezone: string;
    language: string;
    platform: string;
    user_agent: string;
    canvas_fingerprint?: string;
    webgl_fingerprint?: string;
}
/**
 * Advanced user journey tracking with device fingerprinting
 */
export declare class UserJourneyTracker {
    private config;
    private userId?;
    private deviceFingerprint;
    private sessionStartTime;
    private currentPageStartTime;
    private journeyEvents;
    private isTracking;
    constructor(config: ReviConfig);
    /**
     * Start tracking user journey
     */
    startTracking(userId?: string): void;
    /**
     * Stop tracking user journey
     */
    stopTracking(): void;
    /**
     * Set user ID for tracking
     */
    setUserId(userId: string): void;
    /**
     * Track page view with timing
     */
    private trackPageView;
    /**
     * Track user clicks with context
     */
    private trackClick;
    /**
     * Track form submissions
     */
    private trackFormSubmit;
    /**
     * Track API calls and their performance
     */
    trackApiCall(url: string, method: string, status: number, duration: number, size?: number): void;
    /**
     * Track errors in user journey context
     */
    trackError(error: Error, context?: Record<string, any>): void;
    /**
     * Setup event listeners for journey tracking
     */
    private setupJourneyTracking;
    /**
     * Generate device fingerprint for user tracking
     */
    private generateDeviceFingerprint;
    /**
     * Add journey event to buffer
     */
    private addJourneyEvent;
    /**
     * Flush journey events to backend
     */
    private flush;
    /**
     * Send journey events to analytics backend
     */
    private sendJourneyEvents;
    /**
     * Helper methods
     */
    private shouldTrackClick;
    private getElementText;
    private getRelevantAttributes;
    private getConnectionType;
    private countPageInteractions;
    private updateLastPageViewDuration;
    private getSessionId;
}
//# sourceMappingURL=user-journey.d.ts.map