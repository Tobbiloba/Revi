import type { ReviConfig } from './types';
import { generateId } from './utils';
import crypto from 'crypto';

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
export class UserJourneyTracker {
  private config: ReviConfig;
  private userId?: string;
  private deviceFingerprint: string;
  private sessionStartTime: number;
  private currentPageStartTime: number;
  private journeyEvents: JourneyEvent[] = [];
  private isTracking = false;
  private sessionIdProvider?: () => string;

  constructor(config: ReviConfig, sessionIdProvider?: () => string) {
    this.config = config;
    this.sessionIdProvider = sessionIdProvider;
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.sessionStartTime = Date.now();
    this.currentPageStartTime = Date.now();
    
    if (typeof window !== 'undefined') {
      this.setupJourneyTracking();
    }
  }

  /**
   * Start tracking user journey
   */
  startTracking(userId?: string): void {
    this.userId = userId;
    this.isTracking = true;
    
    // Track initial page view
    this.trackPageView();
    
    if (this.config.debug) {
      console.log('Revi: User journey tracking started', { userId, deviceFingerprint: this.deviceFingerprint });
    }
  }

  /**
   * Stop tracking user journey
   */
  stopTracking(): void {
    this.isTracking = false;
    this.flush();
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track page view with timing
   */
  private trackPageView(): void {
    if (!this.isTracking) return;

    const event: JourneyEvent = {
      event_type: 'page_view',
      url: window.location.href,
      referrer: document.referrer || undefined,
      timestamp: Date.now(),
      metadata: {
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        scroll_position: {
          x: window.scrollX,
          y: window.scrollY
        },
        device_fingerprint: this.deviceFingerprint,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        connection_type: this.getConnectionType()
      }
    };

    this.addJourneyEvent(event);
  }

  /**
   * Track user clicks with context
   */
  private trackClick(element: HTMLElement, event: MouseEvent): void {
    if (!this.isTracking) return;

    const journeyEvent: JourneyEvent = {
      event_type: 'click',
      url: window.location.href,
      timestamp: Date.now(),
      metadata: {
        element: {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          class: element.className,
          text: this.getElementText(element),
          attributes: this.getRelevantAttributes(element)
        },
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          page_x: event.pageX,
          page_y: event.pageY
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        scroll_position: {
          x: window.scrollX,
          y: window.scrollY
        }
      }
    };

    this.addJourneyEvent(journeyEvent);
  }

  /**
   * Track form submissions
   */
  private trackFormSubmit(form: HTMLFormElement): void {
    if (!this.isTracking) return;

    const formData = new FormData(form);
    const fields: Record<string, any> = {};
    
    formData.forEach((value, key) => {
      // Only track field names and types, not values for privacy
      const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
      fields[key] = {
        type: input?.type || 'unknown',
        has_value: !!value,
        value_length: typeof value === 'string' ? value.length : 0
      };
    });

    const journeyEvent: JourneyEvent = {
      event_type: 'form_submit',
      url: window.location.href,
      timestamp: Date.now(),
      metadata: {
        form: {
          id: form.id,
          class: form.className,
          method: form.method,
          action: form.action,
          field_count: formData.entries().length
        },
        fields: this.config.privacy?.maskInputs ? {} : fields
      }
    };

    this.addJourneyEvent(journeyEvent);
  }

  /**
   * Track API calls and their performance
   */
  trackApiCall(url: string, method: string, status: number, duration: number, size?: number): void {
    if (!this.isTracking) return;

    const journeyEvent: JourneyEvent = {
      event_type: 'api_call',
      url: window.location.href,
      timestamp: Date.now(),
      duration_ms: duration,
      metadata: {
        api: {
          url,
          method,
          status,
          duration,
          size: size || 0,
          success: status >= 200 && status < 300
        },
        page_context: {
          title: document.title,
          time_on_page: Date.now() - this.currentPageStartTime
        }
      }
    };

    this.addJourneyEvent(journeyEvent);
  }

  /**
   * Track errors in user journey context
   */
  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.isTracking) return;

    const journeyEvent: JourneyEvent = {
      event_type: 'error',
      url: window.location.href,
      timestamp: Date.now(),
      metadata: {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
        },
        user_context: {
          time_on_page: Date.now() - this.currentPageStartTime,
          session_duration: Date.now() - this.sessionStartTime,
          page_interactions: this.countPageInteractions()
        },
        custom_context: context || {}
      }
    };

    this.addJourneyEvent(journeyEvent);
  }

  /**
   * Setup event listeners for journey tracking
   */
  private setupJourneyTracking(): void {
    // Track page views on navigation
    let currentUrl = window.location.href;
    
    const handleNavigation = () => {
      if (window.location.href !== currentUrl) {
        // Track time spent on previous page
        const timeSpent = Date.now() - this.currentPageStartTime;
        this.updateLastPageViewDuration(timeSpent);
        
        // Track new page view
        currentUrl = window.location.href;
        this.currentPageStartTime = Date.now();
        this.trackPageView();
      }
    };

    // Handle navigation events
    window.addEventListener('popstate', handleNavigation);
    
    // Override pushState and replaceState to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(handleNavigation, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleNavigation, 0);
    };

    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target && this.shouldTrackClick(target)) {
        this.trackClick(target, event);
      }
    }, { capture: true, passive: true });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      if (form && form.tagName === 'FORM') {
        this.trackFormSubmit(form);
      }
    }, { capture: true, passive: true });

    // Track page exit
    window.addEventListener('beforeunload', () => {
      const timeSpent = Date.now() - this.currentPageStartTime;
      this.updateLastPageViewDuration(timeSpent);
      this.flush();
    });

    // Periodic flush
    setInterval(() => {
      if (this.journeyEvents.length > 0) {
        this.flush();
      }
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Generate device fingerprint for user tracking
   */
  private generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.platform,
      navigator.cookieEnabled,
      typeof window.localStorage !== 'undefined',
      typeof window.sessionStorage !== 'undefined'
    ];

    // Add canvas fingerprint if available
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        components.push(canvas.toDataURL());
      }
    } catch (e) {
      // Canvas fingerprinting failed
    }

    // Create hash of all components
    const fingerprint = components.join('|');
    
    // Simple hash function (in production, use a proper crypto library)
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Add journey event to buffer
   */
  private addJourneyEvent(event: JourneyEvent): void {
    this.journeyEvents.push(event);

    // Auto-flush if buffer is full
    if (this.journeyEvents.length >= 50) {
      this.flush();
    }
  }

  /**
   * Flush journey events to backend
   */
  private flush(): void {
    if (this.journeyEvents.length === 0) return;

    const events = [...this.journeyEvents];
    this.journeyEvents = [];

    // Send to backend (implement based on your API structure)
    this.sendJourneyEvents(events).catch(error => {
      if (this.config.debug) {
        console.error('Revi: Failed to send journey events', error);
      }
      // Re-add events to buffer for retry
      this.journeyEvents.unshift(...events);
    });
  }

  /**
   * Send journey events to analytics backend
   */
  private async sendJourneyEvents(events: JourneyEvent[]): Promise<void> {
    const apiUrl = this.config.apiUrl || 'https://api.revi.dev';
    
    // Send each event individually (could be optimized for batch sending)
    const promises = events.map(event => 
      fetch(`${apiUrl}/api/analytics/user-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          user_id: this.userId,
          session_id: this.getSessionId(),
          ...event
        })
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Helper methods
   */
  private shouldTrackClick(element: HTMLElement): boolean {
    // Don't track clicks on sensitive elements
    const tag = element.tagName.toLowerCase();
    if (['input', 'textarea'].includes(tag)) {
      const input = element as HTMLInputElement;
      if (['password', 'hidden'].includes(input.type)) {
        return false;
      }
    }

    // Don't track if element has data-revi-ignore attribute
    return !element.hasAttribute('data-revi-ignore');
  }

  private getElementText(element: HTMLElement): string {
    const text = element.textContent || element.innerText || '';
    return text.trim().substring(0, 100);
  }

  private getRelevantAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevantAttrs = ['href', 'src', 'alt', 'title', 'data-testid', 'role'];
    
    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    });
    
    return attrs;
  }

  private getConnectionType(): string {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.effectiveType || connection?.type || 'unknown';
    }
    return 'unknown';
  }

  private countPageInteractions(): number {
    return this.journeyEvents.filter(event => 
      ['click', 'form_submit'].includes(event.event_type)
    ).length;
  }

  private updateLastPageViewDuration(duration: number): void {
    if (this.journeyEvents.length > 0) {
      const lastEvent = this.journeyEvents[this.journeyEvents.length - 1];
      if (lastEvent.event_type === 'page_view') {
        lastEvent.duration_ms = duration;
      }
    }
  }

  private getSessionId(): string {
    // Use the provided session ID provider from Monitor, fallback to placeholder
    if (this.sessionIdProvider) {
      return this.sessionIdProvider();
    }
    
    // Fallback placeholder for standalone usage
    return 'session-' + Date.now();
  }
}