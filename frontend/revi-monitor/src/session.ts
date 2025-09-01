import { generateId, getSessionStorage } from './utils';
import type { SessionEvent, ReviConfig } from './types';

export class SessionManager {
  private sessionId: string;
  private startTime: number;
  private events: SessionEvent[] = [];
  private config: ReviConfig;
  private storage: Storage | null;

  constructor(config: ReviConfig) {
    this.config = config;
    this.storage = getSessionStorage();
    this.sessionId = this.getOrCreateSessionId();
    this.startTime = Date.now();
    
    this.setupEventListeners();
    this.trackPageLoad();
  }

  private getOrCreateSessionId(): string {
    const storageKey = 'revi_session_id';
    
    if (this.storage) {
      const existingId = this.storage.getItem(storageKey);
      if (existingId) return existingId;
    }
    
    const newId = generateId();
    if (this.storage) {
      this.storage.setItem(storageKey, newId);
    }
    
    return newId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // DOM events
    const eventTypes = ['click', 'input', 'change', 'submit', 'focus', 'blur'];
    eventTypes.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.captureEvent(eventType, this.serializeDOMEvent(event));
      }, { capture: true, passive: true });
    });

    // Navigation events
    window.addEventListener('popstate', () => {
      this.captureEvent('navigation', {
        type: 'popstate',
        url: window.location.href,
        timestamp: Date.now()
      });
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      this.captureEvent('visibility', {
        hidden: document.hidden,
        timestamp: Date.now()
      });
    });

    // Scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.captureEvent('scroll', {
          x: window.scrollX,
          y: window.scrollY,
          timestamp: Date.now()
        });
      }, 100);
    }, { passive: true });

    // Resize events (throttled)
    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.captureEvent('resize', {
          width: window.innerWidth,
          height: window.innerHeight,
          timestamp: Date.now()
        });
      }, 100);
    }, { passive: true });

    // Before unload
    window.addEventListener('beforeunload', () => {
      this.captureEvent('beforeunload', {
        timestamp: Date.now(),
        duration: Date.now() - this.startTime
      });
      this.flush();
    });
  }

  private serializeDOMEvent(event: Event): Record<string, any> {
    const target = event.target as HTMLElement;
    if (!target) return {};

    const data: Record<string, any> = {
      type: event.type,
      timestamp: Date.now(),
      target: {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        textContent: this.shouldMaskText(target) ? '[Masked]' : target.textContent?.slice(0, 100)
      }
    };

    // Add specific event data
    if (event.type === 'click') {
      const mouseEvent = event as MouseEvent;
      data.coordinates = {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY
      };
    }

    if (event.type === 'input' || event.type === 'change') {
      const inputEvent = event.target as HTMLInputElement;
      if (inputEvent && inputEvent.value !== undefined) {
        data.value = this.shouldMaskInput(inputEvent) ? '[Masked]' : inputEvent.value;
      }
    }

    return data;
  }

  private shouldMaskInput(element: HTMLInputElement): boolean {
    if (!this.config.privacy?.maskInputs) return false;
    
    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card-number'];
    const sensitiveNames = ['password', 'email', 'phone', 'credit', 'card', 'ssn'];
    
    if (sensitiveTypes.includes(element.type)) return true;
    
    const name = element.name?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    
    return sensitiveNames.some(sensitive => 
      name.includes(sensitive) || id.includes(sensitive)
    );
  }

  private shouldMaskText(element: HTMLElement): boolean {
    if (!this.config.replay?.maskAllText) return false;
    
    // Check for specific selectors that should be masked
    if (this.config.replay?.maskSelector) {
      try {
        return element.matches(this.config.replay.maskSelector);
      } catch {
        return false;
      }
    }
    
    return false;
  }

  private trackPageLoad(): void {
    if (typeof window === 'undefined') return;

    const captureLoadEvent = () => {
      this.captureEvent('page_load', {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timestamp: Date.now(),
        loadTime: performance.now()
      });
    };

    if (document.readyState === 'complete') {
      captureLoadEvent();
    } else {
      window.addEventListener('load', captureLoadEvent);
    }
  }

  captureEvent(type: string, data: Record<string, any>): void {
    // Apply sampling
    if (this.config.sessionSampleRate && Math.random() > this.config.sessionSampleRate) {
      return;
    }

    const event: SessionEvent = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      type,
      data
    };

    // Apply beforeSendSession filter
    const filteredEvent = this.config.beforeSendSession?.(event) || event;
    if (!filteredEvent) return;

    this.events.push(filteredEvent);

    // Auto-flush when buffer is full
    if (this.events.length >= 100) {
      this.flush();
    }
  }

  getEvents(): SessionEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  flush(): SessionEvent[] {
    const events = this.getEvents();
    this.clearEvents();
    return events;
  }

  endSession(): void {
    this.captureEvent('session_end', {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime
    });
    
    if (this.storage) {
      this.storage.removeItem('revi_session_id');
    }
  }
}
