import type { PerformanceEntry, WebVitals, ReviConfig } from './types';

export class PerformanceMonitor {
  private config: ReviConfig;
  private webVitals: WebVitals = {};
  private performanceEntries: PerformanceEntry[] = [];

  constructor(config: ReviConfig) {
    this.config = config;
    
    if (this.config.performance?.captureWebVitals) {
      this.setupWebVitals();
    }
    
    if (this.config.performance?.captureResourceTiming) {
      this.setupResourceTiming();
    }
    
    if (this.config.performance?.captureNavigationTiming) {
      this.setupNavigationTiming();
    }
  }

  private setupWebVitals(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.webVitals.lcp = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        entries.forEach((entry) => {
          this.webVitals.fid = entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.webVitals.cls = clsValue;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported
    }

    // First Contentful Paint (FCP)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.webVitals.fcp = entry.startTime;
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // FCP not supported
    }

    // Time to First Byte (TTFB)
    this.calculateTTFB();
  }

  private calculateTTFB(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as any;
      if (navigationTiming) {
        this.webVitals.ttfb = navigationTiming.responseStart - navigationTiming.requestStart;
      }
    } catch (e) {
      // TTFB calculation failed
    }
  }

  private setupResourceTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.performanceEntries.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            transferSize: (entry as any).transferSize,
            encodedBodySize: (entry as any).encodedBodySize,
            decodedBodySize: (entry as any).decodedBodySize
          });
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      // Resource timing not supported
    }
  }

  private setupNavigationTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    window.addEventListener('load', () => {
      try {
        const navigationTiming = performance.getEntriesByType('navigation')[0] as any;
        if (navigationTiming) {
          this.performanceEntries.push({
            name: 'navigation',
            entryType: 'navigation',
            startTime: navigationTiming.startTime,
            duration: navigationTiming.duration,
            domContentLoadedEventEnd: navigationTiming.domContentLoadedEventEnd,
            domContentLoadedEventStart: navigationTiming.domContentLoadedEventStart,
            loadEventEnd: navigationTiming.loadEventEnd,
            loadEventStart: navigationTiming.loadEventStart,
            domComplete: navigationTiming.domComplete,
            domInteractive: navigationTiming.domInteractive
          });
        }
      } catch (e) {
        // Navigation timing failed
      }
    });
  }

  getWebVitals(): WebVitals {
    return { ...this.webVitals };
  }

  getPerformanceEntries(): PerformanceEntry[] {
    return [...this.performanceEntries];
  }

  clearPerformanceEntries(): void {
    this.performanceEntries = [];
  }

  // Custom performance marks
  mark(name: string): void {
    if (typeof window !== 'undefined' && window.performance && typeof window.performance.mark === 'function') {
      try {
        performance.mark(name);
      } catch (e) {
        // Mark failed
      }
    }
  }

  measure(name: string, startMark?: string, endMark?: string): number | null {
    if (typeof window === 'undefined' || !window.performance || !window.performance.measure) {
      return null;
    }

    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      return measure ? measure.duration : null;
    } catch (e) {
      return null;
    }
  }
}
