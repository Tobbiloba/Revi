'use client';

import { useCallback } from 'react';

export interface CSSRule {
  type: number;
  cssText: string;
  selectorText?: string;
  declarations?: CSSDeclaration[];
  media?: string;
}

export interface CSSDeclaration {
  property: string;
  value: string;
  priority: string;
  important: boolean;
}

export interface Stylesheet {
  href?: string;
  cssText: string;
  disabled: boolean;
  media?: string;
  title?: string;
  rules: CSSRule[];
}

/**
 * CSS Reconstruction Engine for accurate session replay styling
 */
export class CSSReconstructionEngine {
  private iframe: HTMLIFrameElement;
  private stylesheetCache = new Map<string, string>();
  
  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
  }

  /**
   * Inject stylesheets into the replay iframe
   */
  async injectStylesheets(stylesheets: Stylesheet[]): Promise<void> {
    const iframeDoc = this.iframe.contentDocument;
    if (!iframeDoc) return;

    // Clear existing stylesheets (except our replay styles)
    const existingStyles = iframeDoc.querySelectorAll('link[rel="stylesheet"], style:not([data-revi-replay])');
    existingStyles.forEach(style => style.remove());

    // Inject each stylesheet
    for (const stylesheet of stylesheets) {
      await this.injectStylesheet(stylesheet, iframeDoc);
    }

    // Add our custom replay styles last to ensure they have precedence
    this.injectReplayStyles(iframeDoc);
  }

  /**
   * Inject a single stylesheet
   */
  private async injectStylesheet(stylesheet: Stylesheet, iframeDoc: Document): Promise<void> {
    if (stylesheet.href && !stylesheet.disabled) {
      // External stylesheet
      await this.injectExternalStylesheet(stylesheet.href, iframeDoc);
    } else if (stylesheet.cssText && !stylesheet.disabled) {
      // Inline stylesheet
      this.injectInlineStylesheet(stylesheet.cssText, iframeDoc, stylesheet.media);
    }
  }

  /**
   * Inject external stylesheet with caching
   */
  private async injectExternalStylesheet(href: string, iframeDoc: Document): Promise<void> {
    try {
      // Check cache first
      let cssText = this.stylesheetCache.get(href);
      
      if (!cssText) {
        // Fetch stylesheet
        const response = await fetch(href);
        if (response.ok) {
          cssText = await response.text();
          this.stylesheetCache.set(href, cssText);
        } else {
          console.warn(`Failed to load stylesheet: ${href}`);
          return;
        }
      }

      // Create style element
      const styleElement = iframeDoc.createElement('style');
      styleElement.textContent = cssText;
      styleElement.setAttribute('data-original-href', href);
      iframeDoc.head.appendChild(styleElement);
      
    } catch (error) {
      console.warn(`Error loading stylesheet ${href}:`, error);
      
      // Fallback: try to load as link element
      const linkElement = iframeDoc.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = href;
      linkElement.onerror = () => console.warn(`Failed to load fallback stylesheet: ${href}`);
      iframeDoc.head.appendChild(linkElement);
    }
  }

  /**
   * Inject inline stylesheet
   */
  private injectInlineStylesheet(cssText: string, iframeDoc: Document, media?: string): void {
    const styleElement = iframeDoc.createElement('style');
    styleElement.textContent = cssText;
    
    if (media && media !== 'all') {
      styleElement.media = media;
    }
    
    iframeDoc.head.appendChild(styleElement);
  }

  /**
   * Inject custom replay styles for enhanced visualization
   */
  private injectReplayStyles(iframeDoc: Document): void {
    const replayStyles = `
      /* Revi Replay Enhancement Styles */
      * {
        /* Prevent layout shifts during replay */
        transform-origin: top left !important;
      }
      
      /* Enhanced cursor styles */
      .revi-cursor {
        position: absolute;
        width: 20px;
        height: 20px;
        pointer-events: none;
        z-index: 999999;
        transition: all 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      
      .revi-cursor::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        border-left: 10px solid #ff4444;
        border-right: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-top: 10px solid #ff4444;
        transform: rotate(-10deg);
      }
      
      .revi-cursor::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 0;
        height: 0;
        border-left: 8px solid #ffffff;
        border-right: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-top: 8px solid #ffffff;
        transform: rotate(-10deg);
      }
      
      /* Click ripple effects */
      .revi-click-ripple {
        position: absolute;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 68, 68, 0.4) 0%, rgba(255, 68, 68, 0.1) 50%, transparent 70%);
        pointer-events: none;
        animation: revi-ripple 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        z-index: 999998;
      }
      
      @keyframes revi-ripple {
        0% {
          transform: scale(0);
          opacity: 1;
        }
        50% {
          opacity: 0.8;
        }
        100% {
          transform: scale(6);
          opacity: 0;
        }
      }
      
      /* Element highlighting */
      .revi-highlight {
        outline: 2px solid #ff4444 !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 68, 68, 0.1) !important;
        animation: revi-highlight-pulse 0.6s ease-in-out !important;
        z-index: 999997 !important;
        position: relative !important;
      }
      
      @keyframes revi-highlight-pulse {
        0%, 100% {
          outline-color: #ff4444;
          background-color: rgba(255, 68, 68, 0.1);
        }
        50% {
          outline-color: #ff6666;
          background-color: rgba(255, 68, 68, 0.2);
        }
      }
      
      /* Input highlighting */
      .revi-input-highlight {
        background-color: rgba(68, 255, 68, 0.15) !important;
        border-color: #44ff44 !important;
        box-shadow: 0 0 0 2px rgba(68, 255, 68, 0.3) !important;
        animation: revi-input-glow 0.8s ease-in-out !important;
      }
      
      @keyframes revi-input-glow {
        0% {
          box-shadow: 0 0 0 0px rgba(68, 255, 68, 0.5);
        }
        50% {
          box-shadow: 0 0 0 4px rgba(68, 255, 68, 0.3);
        }
        100% {
          box-shadow: 0 0 0 0px rgba(68, 255, 68, 0.0);
        }
      }
      
      /* Error highlighting */
      .revi-error-highlight {
        background-color: rgba(255, 0, 0, 0.1) !important;
        border: 2px dashed #ff0000 !important;
        animation: revi-error-shake 0.8s ease-in-out !important;
      }
      
      @keyframes revi-error-shake {
        0%, 20%, 40%, 60%, 80%, 100% { 
          transform: translateX(0); 
        }
        10%, 30%, 50%, 70%, 90% { 
          transform: translateX(-3px); 
        }
      }
      
      /* Typing indicator */
      .revi-typing-indicator {
        position: relative;
      }
      
      .revi-typing-indicator::after {
        content: '|';
        color: #44ff44;
        animation: revi-typing-blink 1s infinite;
        font-weight: bold;
      }
      
      @keyframes revi-typing-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      
      /* Scroll indicators */
      .revi-scroll-indicator {
        position: fixed;
        right: 10px;
        top: 50%;
        width: 4px;
        height: 100px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        z-index: 999996;
      }
      
      .revi-scroll-thumb {
        position: absolute;
        width: 100%;
        background: #ff4444;
        border-radius: 2px;
        transition: all 0.2s ease;
      }
      
      /* Network request indicators */
      .revi-network-loading {
        position: relative;
      }
      
      .revi-network-loading::before {
        content: '';
        position: absolute;
        top: -2px;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #4444ff, transparent);
        animation: revi-network-progress 1.5s infinite;
      }
      
      @keyframes revi-network-progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      
      /* Enhanced focus styles */
      .revi-focused {
        outline: 2px solid #4444ff !important;
        outline-offset: 1px !important;
        box-shadow: 0 0 0 3px rgba(68, 68, 255, 0.2) !important;
      }
      
      /* Hover effects */
      .revi-hovered {
        background-color: rgba(68, 68, 255, 0.05) !important;
        transition: background-color 0.2s ease !important;
      }
      
      /* Page transition effects */
      .revi-page-transition {
        animation: revi-page-fade-in 0.5s ease-in-out;
      }
      
      @keyframes revi-page-fade-in {
        0% { 
          opacity: 0; 
          transform: translateY(20px); 
        }
        100% { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      
      /* Responsive enhancements */
      @media (max-width: 768px) {
        .revi-cursor {
          width: 24px;
          height: 24px;
        }
        
        .revi-highlight {
          outline-width: 3px !important;
        }
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .revi-cursor::before {
          border-left-color: #000000;
          border-top-color: #000000;
        }
        
        .revi-highlight {
          outline-color: #000000 !important;
          background-color: rgba(0, 0, 0, 0.1) !important;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .revi-cursor {
          transition: none !important;
        }
        
        .revi-click-ripple {
          animation: none !important;
          opacity: 0.5 !important;
        }
        
        .revi-highlight {
          animation: none !important;
        }
        
        .revi-input-highlight {
          animation: none !important;
        }
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .revi-highlight {
          background-color: rgba(255, 68, 68, 0.2) !important;
        }
        
        .revi-input-highlight {
          background-color: rgba(68, 255, 68, 0.2) !important;
        }
      }
    `;

    const styleElement = iframeDoc.createElement('style');
    styleElement.textContent = replayStyles;
    styleElement.setAttribute('data-revi-replay', 'true');
    iframeDoc.head.appendChild(styleElement);
  }

  /**
   * Apply computed styles to elements during reconstruction
   */
  applyComputedStyles(element: HTMLElement, computedStyles: Record<string, string>): void {
    // Critical styles that affect layout and visibility
    const criticalStyles = [
      'display', 'position', 'top', 'right', 'bottom', 'left', 
      'width', 'height', 'margin', 'padding', 'border', 
      'background', 'color', 'font', 'opacity', 'visibility',
      'z-index', 'transform', 'overflow'
    ];

    Object.entries(computedStyles).forEach(([property, value]) => {
      if (criticalStyles.some(critical => property.startsWith(critical))) {
        try {
          (element.style as unknown as Record<string, unknown>)[property] = value;
        } catch (error) {
          console.warn(`Failed to apply style ${property}: ${value}`, error);
        }
      }
    });
  }

  /**
   * Create enhanced cursor element with trails
   */
  createEnhancedCursor(iframeDoc: Document): HTMLElement {
    const cursor = iframeDoc.createElement('div');
    cursor.id = 'revi-cursor';
    cursor.className = 'revi-cursor';
    cursor.style.display = 'none';
    
    // Add cursor trail elements
    for (let i = 0; i < 5; i++) {
      const trail = iframeDoc.createElement('div');
      trail.className = 'revi-cursor-trail';
      trail.style.cssText = `
        position: absolute;
        width: ${16 - i * 2}px;
        height: ${16 - i * 2}px;
        background: rgba(255, 68, 68, ${0.6 - i * 0.1});
        border-radius: 50%;
        pointer-events: none;
        opacity: 0;
        transition: all 0.${2 + i}s ease-out;
      `;
      cursor.appendChild(trail);
    }
    
    return cursor;
  }

  /**
   * Update cursor position with trail effect
   */
  updateCursorPosition(x: number, y: number): void {
    const iframeDoc = this.iframe.contentDocument;
    if (!iframeDoc) return;

    const cursor = iframeDoc.getElementById('revi-cursor');
    if (!cursor) return;

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.display = 'block';

    // Update cursor trails
    const trails = cursor.querySelectorAll('.revi-cursor-trail');
    trails.forEach((trail, index) => {
      setTimeout(() => {
        (trail as HTMLElement).style.left = `${x - (8 - index)}px`;
        (trail as HTMLElement).style.top = `${y - (8 - index)}px`;
        (trail as HTMLElement).style.opacity = '1';
        
        setTimeout(() => {
          (trail as HTMLElement).style.opacity = '0';
        }, 100);
      }, index * 50);
    });
  }

  /**
   * Create network loading indicator
   */
  showNetworkActivity(element: HTMLElement, duration: number): void {
    element.classList.add('revi-network-loading');
    
    setTimeout(() => {
      element.classList.remove('revi-network-loading');
    }, duration);
  }

  /**
   * Preload common fonts and assets for better replay accuracy
   */
  async preloadAssets(): Promise<void> {
    const iframeDoc = this.iframe.contentDocument;
    if (!iframeDoc) return;

    // Preload common system fonts
    const fontPreloads = [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ];

    fontPreloads.forEach(font => {
      const link = iframeDoc.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.href = `data:font/woff2;base64,${btoa(font)}`; // Simplified
      link.crossOrigin = 'anonymous';
      iframeDoc.head.appendChild(link);
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stylesheetCache.clear();
  }
}

/**
 * React hook for CSS reconstruction
 */
export function useCSSReconstruction(iframe: HTMLIFrameElement | null) {
  const createEngine = useCallback(() => {
    if (!iframe) return null;
    return new CSSReconstructionEngine(iframe);
  }, [iframe]);

  const injectStylesheets = useCallback(async (stylesheets: Stylesheet[]) => {
    const engine = createEngine();
    if (engine) {
      await engine.injectStylesheets(stylesheets);
    }
  }, [createEngine]);

  const applyComputedStyles = useCallback((element: HTMLElement, styles: Record<string, string>) => {
    const engine = createEngine();
    if (engine) {
      engine.applyComputedStyles(element, styles);
    }
  }, [createEngine]);

  return {
    injectStylesheets,
    applyComputedStyles,
    createEngine
  };
}