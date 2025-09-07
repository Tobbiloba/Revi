'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
  url?: string;
  sessionId: string;
  metadata: {
    element?: {
      tagName: string;
      className?: string;
      id?: string;
      xpath?: string;
      selector?: string;
    };
    userAgent?: string;
    viewport?: { width: number; height: number };
    console?: string[];
    networkRequests?: Array<{
      url: string;
      status: number;
      timestamp: number;
    }>;
  };
}

export interface InteractionEvent {
  id: string;
  type: 'click' | 'input' | 'scroll' | 'navigation' | 'focus' | 'blur';
  timestamp: number;
  target?: {
    tagName: string;
    className?: string;
    id?: string;
    xpath?: string;
    selector?: string;
  };
  data?: unknown;
}

export interface ErrorCorrelation {
  errorId: string;
  error: ErrorEvent;
  leadingInteractions: InteractionEvent[];
  relatedElements: string[];
  errorSeverity: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  suggestions: string[];
  timeToError: number;
  userPath: string[];
}

/**
 * Advanced error correlation engine that analyzes errors in context
 */
export class ErrorCorrelationEngine {
  private iframe: HTMLIFrameElement;
  private errors: ErrorEvent[] = [];
  private interactions: InteractionEvent[] = [];
  private correlations: Map<string, ErrorCorrelation> = new Map();
  private highlightOverlays: Map<string, HTMLElement> = new Map();
  private activeErrorId: string | null = null;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
  }

  /**
   * Add error for correlation analysis
   */
  addError(error: ErrorEvent): void {
    this.errors.push(error);
    this.analyzeErrorCorrelation(error);
  }

  /**
   * Add interaction for correlation analysis
   */
  addInteraction(interaction: InteractionEvent): void {
    this.interactions.push(interaction);
    // Reanalyze recent errors that might be affected
    this.reanalyzeRecentErrors(interaction.timestamp);
  }

  /**
   * Analyze error correlation with preceding interactions
   */
  private analyzeErrorCorrelation(error: ErrorEvent): void {
    // Find interactions within 10 seconds before the error
    const timeWindow = 10000; // 10 seconds
    const leadingInteractions = this.interactions.filter(
      interaction => 
        interaction.timestamp >= error.timestamp - timeWindow &&
        interaction.timestamp <= error.timestamp
    ).sort((a, b) => a.timestamp - b.timestamp);

    // Determine error severity based on error type and frequency
    const errorSeverity = this.calculateErrorSeverity(error);

    // Analyze user path leading to error
    const userPath = this.analyzeUserPath(leadingInteractions);

    // Find related elements
    const relatedElements = this.findRelatedElements(error, leadingInteractions);

    // Determine root cause
    const rootCause = this.determineRootCause(error, leadingInteractions);

    // Generate suggestions
    const suggestions = this.generateSuggestions(error, leadingInteractions, rootCause);

    // Calculate time to error
    const timeToError = leadingInteractions.length > 0 
      ? error.timestamp - leadingInteractions[0].timestamp
      : 0;

    const correlation: ErrorCorrelation = {
      errorId: error.id,
      error,
      leadingInteractions,
      relatedElements,
      errorSeverity,
      rootCause,
      suggestions,
      timeToError,
      userPath
    };

    this.correlations.set(error.id, correlation);
  }

  /**
   * Calculate error severity based on context
   */
  private calculateErrorSeverity(error: ErrorEvent): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('uncaught') || 
        message.includes('cannot read property') ||
        message.includes('network error') ||
        message.includes('failed to fetch')) {
      return 'critical';
    }
    
    // High severity errors
    if (message.includes('reference error') ||
        message.includes('type error') ||
        message.includes('syntax error')) {
      return 'high';
    }
    
    // Medium severity
    if (message.includes('warning') || 
        message.includes('deprecated')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Analyze user path leading to error
   */
  private analyzeUserPath(interactions: InteractionEvent[]): string[] {
    return interactions
      .filter(interaction => interaction.type === 'navigation' || interaction.type === 'click')
      .map(interaction => {
        if (interaction.type === 'navigation') {
          return (interaction.data as Record<string, unknown>)?.url as string || 'Unknown page';
        }
        if (interaction.target?.id) {
          return `#${interaction.target.id}`;
        }
        if (interaction.target?.className) {
          return `.${interaction.target.className.split(' ')[0]}`;
        }
        return interaction.target?.tagName || 'Unknown element';
      });
  }

  /**
   * Find elements related to the error
   */
  private findRelatedElements(error: ErrorEvent, interactions: InteractionEvent[]): string[] {
    const relatedElements: Set<string> = new Set();
    
    // Add element from error metadata
    if (error.metadata.element?.selector) {
      relatedElements.add(error.metadata.element.selector);
    }
    
    // Add elements from recent interactions
    interactions.forEach(interaction => {
      if (interaction.target?.selector) {
        relatedElements.add(interaction.target.selector);
      } else if (interaction.target?.id) {
        relatedElements.add(`#${interaction.target.id}`);
      } else if (interaction.target?.className) {
        relatedElements.add(`.${interaction.target.className.split(' ')[0]}`);
      }
    });
    
    return Array.from(relatedElements);
  }

  /**
   * Determine root cause of error
   */
  private determineRootCause(error: ErrorEvent, interactions: InteractionEvent[]): string {
    const message = error.message.toLowerCase();
    
    // Network-related errors
    if (message.includes('failed to fetch') || message.includes('network error')) {
      return 'Network connectivity issue or API endpoint unavailable';
    }
    
    // Element interaction errors
    if (message.includes('cannot read property') || message.includes('undefined')) {
      const lastInteraction = interactions[interactions.length - 1];
      if (lastInteraction?.type === 'click') {
        return 'User clicked on element before it was fully initialized';
      }
      return 'Attempted to access property of undefined object';
    }
    
    // Form validation errors
    if (interactions.some(i => i.type === 'input') && message.includes('validation')) {
      return 'Form validation failed due to invalid user input';
    }
    
    // JavaScript execution errors
    if (message.includes('syntax error') || message.includes('unexpected token')) {
      return 'JavaScript syntax error in loaded script';
    }
    
    return 'Unknown error - requires manual investigation';
  }

  /**
   * Generate actionable suggestions
   */
  private generateSuggestions(
    error: ErrorEvent, 
    interactions: InteractionEvent[], 
    rootCause: string
  ): string[] {
    const suggestions: string[] = [];
    console.log(error)
    
    if (rootCause.includes('Network')) {
      suggestions.push('Add retry logic for network requests');
      suggestions.push('Implement offline fallback handling');
      suggestions.push('Add loading states during API calls');
    }
    
    if (rootCause.includes('undefined') || rootCause.includes('null')) {
      suggestions.push('Add null/undefined checks before property access');
      suggestions.push('Implement proper error boundaries');
      suggestions.push('Add loading states for async data');
    }
    
    if (rootCause.includes('validation')) {
      suggestions.push('Improve form validation feedback');
      suggestions.push('Add client-side validation before submission');
      suggestions.push('Provide clear error messages to users');
    }
    
    if (interactions.length > 5) {
      suggestions.push('Consider reducing complex user flows');
      suggestions.push('Add progress indicators for multi-step processes');
    }
    
    // Always add generic suggestions
    suggestions.push('Add comprehensive error logging');
    suggestions.push('Implement user-friendly error messages');
    
    return suggestions;
  }

  /**
   * Reanalyze recent errors when new interactions are added
   */
  private reanalyzeRecentErrors(interactionTimestamp: number): void {
    const recentTimeWindow = 30000; // 30 seconds
    
    this.errors
      .filter(error => error.timestamp >= interactionTimestamp - recentTimeWindow)
      .forEach(error => this.analyzeErrorCorrelation(error));
  }

  /**
   * Highlight error-related elements in the iframe
   */
  highlightErrorElements(errorId: string): void {
    this.clearHighlights();
    
    const correlation = this.correlations.get(errorId);
    if (!correlation) return;
    
    const iframeDoc = this.iframe.contentDocument;
    if (!iframeDoc) return;
    
    this.activeErrorId = errorId;
    
    // Highlight each related element
    correlation.relatedElements.forEach((selector, index) => {
      try {
        const elements = iframeDoc.querySelectorAll(selector);
        elements.forEach((element, elementIndex) => {
          this.addErrorHighlight(
            element as HTMLElement, 
            correlation.errorSeverity,
            `${errorId}-${index}-${elementIndex}`
          );
        });
      } catch (error) {
        console.warn(`Failed to highlight element with selector: ${selector}`, error);
      }
    });
    
    // Add error indicator overlay
    this.addErrorIndicator(correlation);
  }

  /**
   * Add visual highlight to an element
   */
  private addErrorHighlight(element: HTMLElement, severity: string, highlightId: string): void {
    // Create highlight overlay
    const highlight = this.iframe.contentDocument!.createElement('div');
    highlight.className = 'revi-error-highlight';
    highlight.setAttribute('data-highlight-id', highlightId);
    
    // Position and style the highlight
    const rect = element.getBoundingClientRect();
    const iframeDoc = this.iframe.contentDocument!;
    
    highlight.style.cssText = `
      position: absolute;
      top: ${rect.top + iframeDoc.documentElement.scrollTop}px;
      left: ${rect.left + iframeDoc.documentElement.scrollLeft}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 999999;
      border: 3px solid ${this.getSeverityColor(severity)};
      background: ${this.getSeverityColor(severity, 0.1)};
      border-radius: 4px;
      animation: revi-error-pulse 2s infinite;
      box-shadow: 0 0 20px ${this.getSeverityColor(severity, 0.3)};
    `;
    
    // Add pulsing animation if not exists
    if (!iframeDoc.querySelector('#revi-error-animations')) {
      const style = iframeDoc.createElement('style');
      style.id = 'revi-error-animations';
      style.textContent = `
        @keyframes revi-error-pulse {
          0%, 100% { 
            opacity: 0.6;
            transform: scale(1);
          }
          50% { 
            opacity: 1;
            transform: scale(1.02);
          }
        }
        
        @keyframes revi-error-shake {
          0%, 20%, 40%, 60%, 80%, 100% { 
            transform: translateX(0); 
          }
          10%, 30%, 50%, 70%, 90% { 
            transform: translateX(-2px); 
          }
        }
        
        .revi-error-highlight-critical {
          animation: revi-error-pulse 1s infinite, revi-error-shake 0.5s infinite;
        }
      `;
      iframeDoc.head.appendChild(style);
    }
    
    // Add severity-specific class
    if (severity === 'critical') {
      highlight.classList.add('revi-error-highlight-critical');
    }
    
    iframeDoc.body.appendChild(highlight);
    this.highlightOverlays.set(highlightId, highlight);
  }

  /**
   * Add error indicator with details
   */
  private addErrorIndicator(correlation: ErrorCorrelation): void {
    const iframeDoc = this.iframe.contentDocument!;
    
    // Create error indicator panel
    const indicator = iframeDoc.createElement('div');
    indicator.className = 'revi-error-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      border: 1px solid #e2e8f0;
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      overflow: hidden;
      max-height: 400px;
      animation: revi-slide-in 0.3s ease-out;
    `;
    
    // Add slide-in animation
    if (!iframeDoc.querySelector('#revi-indicator-animations')) {
      const style = iframeDoc.createElement('style');
      style.id = 'revi-indicator-animations';
      style.textContent = `
        @keyframes revi-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      iframeDoc.head.appendChild(style);
    }
    
    // Create indicator content
    const severityIcon = this.getSeverityIcon(correlation.errorSeverity);
    const severityColor = this.getSeverityColor(correlation.errorSeverity);
    
    indicator.innerHTML = `
      <div style="background: ${severityColor}; color: white; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${severityIcon}
          <span style="font-weight: 600; text-transform: capitalize;">${correlation.errorSeverity} Error</span>
        </div>
        <button class="revi-close-btn" style="background: none; border: none; color: white; cursor: pointer; padding: 4px;">
          ✕
        </button>
      </div>
      <div style="padding: 16px;">
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #1a202c; margin-bottom: 4px;">Error Message</div>
          <div style="background: #f7fafc; padding: 8px; border-radius: 4px; font-size: 12px; font-family: monospace; color: #2d3748;">
            ${correlation.error.message}
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #1a202c; margin-bottom: 4px;">Root Cause</div>
          <div style="color: #4a5568; font-size: 13px;">${correlation.rootCause}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #1a202c; margin-bottom: 4px;">User Path</div>
          <div style="color: #4a5568; font-size: 12px;">
            ${correlation.userPath.join(' → ') || 'No interactions recorded'}
          </div>
        </div>
        <div>
          <div style="font-weight: 600; color: #1a202c; margin-bottom: 8px;">Suggestions</div>
          <div style="max-height: 120px; overflow-y: auto;">
            ${correlation.suggestions.map(suggestion => 
              `<div style="display: flex; align-items: start; gap: 6px; margin-bottom: 6px; font-size: 12px;">
                <span style="color: #48bb78; margin-top: 2px;">•</span>
                <span style="color: #4a5568;">${suggestion}</span>
              </div>`
            ).join('')}
          </div>
        </div>
      </div>
    `;
    
    // Add close functionality
    const closeBtn = indicator.querySelector('.revi-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.clearHighlights();
    });
    
    iframeDoc.body.appendChild(indicator);
    this.highlightOverlays.set('error-indicator', indicator);
  }

  /**
   * Clear all error highlights
   */
  clearHighlights(): void {
    this.highlightOverlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    this.highlightOverlays.clear();
    this.activeErrorId = null;
  }

  /**
   * Get color for error severity
   */
  private getSeverityColor(severity: string, alpha = 1): string {
    const colors = {
      low: `rgba(59, 130, 246, ${alpha})`, // blue
      medium: `rgba(245, 158, 11, ${alpha})`, // yellow
      high: `rgba(239, 68, 68, ${alpha})`, // red
      critical: `rgba(147, 51, 234, ${alpha})` // purple
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  }

  /**
   * Get icon for error severity
   */
  private getSeverityIcon(severity: string): string {
    const icons = {
      low: '⚠️',
      medium: '🔶',
      high: '🚨',
      critical: '💥'
    };
    return icons[severity as keyof typeof icons] || '⚠️';
  }

  /**
   * Get all error correlations
   */
  getCorrelations(): ErrorCorrelation[] {
    return Array.from(this.correlations.values());
  }

  /**
   * Get correlation for specific error
   */
  getCorrelation(errorId: string): ErrorCorrelation | null {
    return this.correlations.get(errorId) || null;
  }

  /**
   * Get currently active error
   */
  getActiveError(): string | null {
    return this.activeErrorId;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearHighlights();
    this.errors = [];
    this.interactions = [];
    this.correlations.clear();
  }
}

/**
 * React hook for error correlation
 */
export function useErrorCorrelation(iframe: HTMLIFrameElement | null) {
  const [correlations, setCorrelations] = useState<ErrorCorrelation[]>([]);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);
  const engineRef = useRef<ErrorCorrelationEngine | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Update iframe ref when it changes
  useEffect(() => {
    iframeRef.current = iframe;
    // Initialize engine if iframe becomes available
    if (iframe && !engineRef.current) {
      engineRef.current = new ErrorCorrelationEngine(iframe);
    }
  }, [iframe]);

  const initializeEngine = useCallback(() => {
    const currentIframe = iframeRef.current;
    if (!currentIframe) return null;
    
    const engine = new ErrorCorrelationEngine(currentIframe);
    engineRef.current = engine;
    return engine;
  }, []); // No dependencies - stable reference

  const addError = useCallback((error: ErrorEvent) => {
    const engine = engineRef.current || initializeEngine();
    if (engine) {
      engine.addError(error);
      setCorrelations(engine.getCorrelations());
    }
  }, [initializeEngine]);

  const addInteraction = useCallback((interaction: InteractionEvent) => {
    const engine = engineRef.current || initializeEngine();
    if (engine) {
      engine.addInteraction(interaction);
      setCorrelations(engine.getCorrelations());
    }
  }, [initializeEngine]);

  const highlightError = useCallback((errorId: string) => {
    const engine = engineRef.current;
    if (engine) {
      engine.highlightErrorElements(errorId);
      setActiveErrorId(errorId);
    }
  }, []);

  const clearHighlights = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.clearHighlights();
      setActiveErrorId(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  return {
    correlations,
    activeErrorId,
    addError,
    addInteraction,
    highlightError,
    clearHighlights,
    initializeEngine
  };
}