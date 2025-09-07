import type { ReviConfig } from './types';

export interface EnhancedSerializedNode {
  id: number;
  type: 'element' | 'text' | 'comment' | 'document' | 'doctype';
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: EnhancedSerializedNode[];
  parentId?: number;
  
  // Enhanced styling and layout information
  computedStyles?: Record<string, string>;
  inlineStyles?: Record<string, string>;
  cssRules?: CSSRule[];
  boundingRect?: DOMRect;
  visibility?: {
    visible: boolean;
    opacity: number;
    display: string;
    zIndex: number;
  };
  
  // Interactive state
  interactionState?: {
    focused: boolean;
    hovered: boolean;
    pressed: boolean;
    disabled: boolean;
    checked?: boolean;
    selected?: boolean;
  };
  
  // Content state for form elements
  inputValue?: string;
  selectedOptions?: string[];
  scrollPosition?: { x: number; y: number };
  
  // Performance metrics
  renderTime?: number;
  memoryUsage?: number;
}

export interface EnhancedDOMSnapshot {
  timestamp: number;
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
    scrollX: number;
    scrollY: number;
  };
  nodes: EnhancedSerializedNode[];
  stylesheets: EnhancedStylesheet[];
  resources: EnhancedResource[];
  
  // Page performance metrics
  performance?: {
    domContentLoaded: number;
    loadComplete: number;
    paintTimings: Record<string, number>;
    layoutShifts: any[];
    memoryUsage: number;
  };
  
  // Environment info
  environment?: {
    userAgent: string;
    language: string;
    timezone: string;
    colorScheme: 'light' | 'dark';
    reducedMotion: boolean;
  };
}

export interface EnhancedStylesheet {
  href?: string;
  cssText: string;
  disabled: boolean;
  media?: string;
  title?: string;
  type?: string;
  origin: 'author' | 'user' | 'user-agent';
  
  // Processed rules for better reconstruction
  rules: ProcessedCSSRule[];
  
  // Performance
  loadTime?: number;
  size: number;
}

export interface ProcessedCSSRule {
  type: number;
  cssText: string;
  selectorText?: string;
  declarations?: CSSDeclaration[];
  media?: string;
  
  // Computed specificity and usage
  specificity?: number;
  usage?: {
    matchedElements: number[];
    frequency: number;
  };
}

export interface CSSDeclaration {
  property: string;
  value: string;
  priority: string;
  important: boolean;
}

export interface EnhancedResource {
  url: string;
  type: 'image' | 'font' | 'media' | 'script' | 'stylesheet' | 'fetch' | 'document';
  method?: string;
  status?: number;
  size?: number;
  mimeType?: string;
  loadTime?: number;
  fromCache?: boolean;
  
  // For images
  dimensions?: { width: number; height: number };
  
  // Small resources can be inlined
  data?: string; // Base64 encoded
  failed?: boolean;
  blocked?: boolean;
}

export interface EnhancedDOMChange extends DOMChange {
  // Additional context
  causedBy?: {
    type: 'user-interaction' | 'script' | 'network' | 'animation' | 'media-query';
    details?: any;
  };
  
  // Performance impact
  renderingTime?: number;
  layoutThrashing?: boolean;
  
  // Visual impact
  visualChange?: {
    affectedArea: DOMRect;
    significance: 'minor' | 'moderate' | 'major';
  };
}

export interface DOMChange {
  timestamp: number;
  type: 'childList' | 'attributes' | 'characterData' | 'style' | 'class' | 'dataset';
  target: number; // Node ID
  addedNodes?: EnhancedSerializedNode[];
  removedNodes?: number[]; // Node IDs
  attributeName?: string;
  attributeValue?: string;
  oldValue?: string;
  newValue?: string;
  
  // Style-specific changes
  styleChanges?: {
    property: string;
    oldValue: string;
    newValue: string;
    computed?: boolean;
  }[];
  
  // Class changes
  classChanges?: {
    added: string[];
    removed: string[];
  };
}

/**
 * Enhanced DOM serializer with advanced styling, layout, and interaction capture
 */
export class EnhancedDOMSerializer {
  // private _config: ReviConfig;
  private nodeIdMap = new WeakMap<Node, number>();
  private nodeMap = new Map<number, Node>();
  private nextNodeId = 1;
  private observer?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private isObserving = false;
  private onDOMChange?: (change: EnhancedDOMChange) => void;
  
  // Performance tracking
  private performanceObserver?: PerformanceObserver;
  private layoutShiftEntries: any[] = [];
  
  // Style tracking
  // private _stylesheetMap = new Map<CSSStyleSheet, EnhancedStylesheet>();
  private computedStyleCache = new WeakMap<Element, Record<string, string>>();

  constructor(_config: ReviConfig) {
    // this._config = config;
    this.setupPerformanceObserver();
    this.setupStylesheetTracking();
  }

  /**
   * Take an enhanced snapshot of the DOM with styling and layout information
   */
  takeEnhancedSnapshot(): EnhancedDOMSnapshot {
    const startTime = performance.now();
    
    const snapshot: EnhancedDOMSnapshot = {
      timestamp: Date.now(),
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      nodes: [],
      stylesheets: [],
      resources: [],
      
      performance: this.capturePerformanceMetrics(),
      environment: this.captureEnvironmentInfo()
    };

    // Serialize DOM with enhanced information
    snapshot.nodes = this.serializeDocumentEnhanced(document);
    
    // Capture stylesheets with processed rules
    snapshot.stylesheets = this.serializeStylesheetsEnhanced();
    
    // Capture resources with detailed metadata
    snapshot.resources = this.serializeResourcesEnhanced();

    const endTime = performance.now();
    console.log(`Enhanced DOM snapshot taken in ${endTime - startTime}ms`);

    return snapshot;
  }

  /**
   * Start observing DOM changes with enhanced tracking
   */
  startEnhancedObserving(onDOMChange: (change: EnhancedDOMChange) => void): void {
    if (this.isObserving) return;

    this.onDOMChange = onDOMChange;
    this.observer = new MutationObserver(this.handleEnhancedMutations.bind(this));
    
    this.observer.observe(document, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true,
      attributeFilter: undefined // Capture all attributes
    });

    // Observe resize changes
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResizeChanges.bind(this));
      this.resizeObserver.observe(document.documentElement);
    }

    this.isObserving = true;
  }

  /**
   * Stop observing DOM changes
   */
  stopEnhancedObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.isObserving = false;
    this.onDOMChange = undefined;
  }

  /**
   * Serialize document with enhanced information
   */
  private serializeDocumentEnhanced(doc: Document): EnhancedSerializedNode[] {
    const nodes: EnhancedSerializedNode[] = [];

    // Add doctype
    if (doc.doctype) {
      nodes.push(this.serializeDoctype(doc.doctype));
    }

    // Serialize document element
    if (doc.documentElement) {
      const serialized = this.serializeNodeEnhanced(doc.documentElement);
      if (serialized) {
        nodes.push(serialized);
      }
    }

    return nodes;
  }

  /**
   * Serialize a single node with enhanced information
   */
  private serializeNodeEnhanced(node: Node): EnhancedSerializedNode | null {
    if (this.shouldIgnoreNode(node)) {
      return null;
    }

    const nodeId = this.getNodeId(node);
    const serialized: EnhancedSerializedNode = {
      id: nodeId,
      type: this.getNodeType(node),
      renderTime: performance.now()
    };

    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        const element = node as Element;
        serialized.tagName = element.tagName.toLowerCase();
        serialized.attributes = this.serializeAttributesEnhanced(element);
        
        // Capture computed styles
        serialized.computedStyles = this.captureComputedStyles(element);
        serialized.inlineStyles = this.captureInlineStyles(element);
        
        // Capture layout information
        serialized.boundingRect = element.getBoundingClientRect();
        serialized.visibility = this.captureVisibilityInfo(element);
        
        // Capture interaction state
        serialized.interactionState = this.captureInteractionState(element);
        
        // Capture form element values
        if (this.isFormElement(element)) {
          serialized.inputValue = this.captureInputValue(element);
          serialized.selectedOptions = this.captureSelectedOptions(element);
        }
        
        // Capture scroll state
        if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
          serialized.scrollPosition = {
            x: element.scrollLeft,
            y: element.scrollTop
          };
        }
        
        // Serialize children
        serialized.children = this.serializeChildrenEnhanced(element);
        break;

      case Node.TEXT_NODE:
        const textNode = node as Text;
        serialized.textContent = this.shouldMaskText(textNode) 
          ? '[Masked Text]' 
          : textNode.textContent || '';
        break;

      case Node.COMMENT_NODE:
        const commentNode = node as Comment;
        serialized.textContent = commentNode.textContent || '';
        break;

      default:
        return null;
    }

    return serialized;
  }

  /**
   * Capture comprehensive computed styles for an element
   */
  private captureComputedStyles(element: Element): Record<string, string> {
    // Check cache first
    if (this.computedStyleCache.has(element)) {
      return this.computedStyleCache.get(element)!;
    }

    const computedStyle = window.getComputedStyle(element);
    const styles: Record<string, string> = {};

    // Critical properties for layout and appearance
    const criticalProperties = [
      // Layout
      'display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border', 'border-width', 'border-style', 'border-color', 'border-radius',
      'box-sizing', 'overflow', 'overflow-x', 'overflow-y', 'z-index',
      
      // Flexbox
      'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
      'flex-grow', 'flex-shrink', 'flex-basis', 'order',
      
      // Grid
      'grid', 'grid-template', 'grid-area', 'justify-self', 'align-self',
      
      // Typography
      'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
      'text-align', 'text-decoration', 'text-transform', 'letter-spacing', 'word-spacing',
      'color', 'text-shadow',
      
      // Background
      'background', 'background-color', 'background-image', 'background-size', 
      'background-position', 'background-repeat', 'background-attachment',
      
      // Effects
      'opacity', 'visibility', 'transform', 'filter', 'backdrop-filter',
      'box-shadow', 'clip-path',
      
      // Animation
      'transition', 'animation', 'will-change',
      
      // Misc
      'cursor', 'pointer-events', 'user-select', 'resize'
    ];

    criticalProperties.forEach(property => {
      const value = computedStyle.getPropertyValue(property);
      if (value && value !== 'initial' && value !== 'inherit') {
        styles[property] = value;
      }
    });

    // Cache the result
    this.computedStyleCache.set(element, styles);
    return styles;
  }

  /**
   * Capture inline styles from the element's style attribute
   */
  private captureInlineStyles(element: Element): Record<string, string> {
    const styles: Record<string, string> = {};
    
    if (element instanceof HTMLElement && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const property = element.style.item(i);
        const value = element.style.getPropertyValue(property);
        const priority = element.style.getPropertyPriority(property);
        
        styles[property] = priority ? `${value} !${priority}` : value;
      }
    }

    return styles;
  }

  /**
   * Capture visibility and display information
   */
  private captureVisibilityInfo(element: Element): EnhancedSerializedNode['visibility'] {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return {
      visible: rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden',
      opacity: parseFloat(computedStyle.opacity),
      display: computedStyle.display,
      zIndex: parseInt(computedStyle.zIndex) || 0
    };
  }

  /**
   * Capture interaction state (focus, hover, etc.)
   */
  private captureInteractionState(element: Element): EnhancedSerializedNode['interactionState'] {
    const state: EnhancedSerializedNode['interactionState'] = {
      focused: document.activeElement === element,
      hovered: element.matches(':hover'),
      pressed: element.matches(':active'),
      disabled: element instanceof HTMLElement ? element.hasAttribute('disabled') : false
    };

    // Form-specific states
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        state.checked = element.checked;
      }
    } else if (element instanceof HTMLSelectElement) {
      state.selected = element.selectedIndex !== -1;
    }

    return state;
  }

  /**
   * Capture form element values
   */
  private captureInputValue(element: Element): string | undefined {
    if (element instanceof HTMLInputElement) {
      // Don't capture sensitive inputs
      if (element.type === 'password' || element.hasAttribute('data-sensitive')) {
        return '[Masked]';
      }
      return element.value;
    } else if (element instanceof HTMLTextAreaElement) {
      return element.value;
    } else if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    
    return undefined;
  }

  /**
   * Capture selected options for select elements
   */
  private captureSelectedOptions(element: Element): string[] | undefined {
    if (element instanceof HTMLSelectElement && element.multiple) {
      const selected = [];
      for (let i = 0; i < element.options.length; i++) {
        if (element.options[i].selected) {
          selected.push(element.options[i].value);
        }
      }
      return selected;
    }
    
    return undefined;
  }

  /**
   * Enhanced stylesheet serialization with processed rules
   */
  private serializeStylesheetsEnhanced(): EnhancedStylesheet[] {
    const stylesheets: EnhancedStylesheet[] = [];

    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        const enhanced = this.processStylesheet(sheet);
        if (enhanced) {
          stylesheets.push(enhanced);
        }
      } catch (error) {
        // Handle CORS issues or other stylesheet access problems
        console.warn('Could not access stylesheet:', error);
      }
    }

    return stylesheets;
  }

  /**
   * Process a stylesheet and extract enhanced information
   */
  private processStylesheet(sheet: CSSStyleSheet): EnhancedStylesheet | null {
    try {
      const rules: ProcessedCSSRule[] = [];
      
      if (sheet.cssRules) {
        for (let i = 0; i < sheet.cssRules.length; i++) {
          const rule = sheet.cssRules[i];
          const processed = this.processCSSRule(rule);
          if (processed) {
            rules.push(processed);
          }
        }
      }

      return {
        href: sheet.href || undefined,
        cssText: this.extractCSSText(sheet),
        disabled: sheet.disabled,
        media: sheet.media.mediaText,
        title: sheet.title || undefined,
        type: sheet.type,
        origin: 'author', // Simplified for now
        rules,
        size: this.estimateStylesheetSize(sheet)
      };
    } catch (error) {
      console.warn('Error processing stylesheet:', error);
      return null;
    }
  }

  /**
   * Process individual CSS rules
   */
  private processCSSRule(rule: CSSRule): ProcessedCSSRule | null {
    const processed: ProcessedCSSRule = {
      type: rule.type,
      cssText: rule.cssText
    };

    if (rule instanceof CSSStyleRule) {
      processed.selectorText = rule.selectorText;
      processed.declarations = this.extractDeclarations(rule.style);
      processed.specificity = this.calculateSpecificity(rule.selectorText);
    } else if (rule instanceof CSSMediaRule) {
      processed.media = rule.media.mediaText;
    }

    return processed;
  }

  /**
   * Extract CSS declarations from a CSSStyleDeclaration
   */
  private extractDeclarations(style: CSSStyleDeclaration): CSSDeclaration[] {
    const declarations: CSSDeclaration[] = [];
    
    for (let i = 0; i < style.length; i++) {
      const property = style.item(i);
      const value = style.getPropertyValue(property);
      const priority = style.getPropertyPriority(property);
      
      declarations.push({
        property,
        value,
        priority,
        important: priority === 'important'
      });
    }

    return declarations;
  }

  /**
   * Calculate CSS selector specificity
   */
  private calculateSpecificity(selector: string): number {
    // Simplified specificity calculation
    const ids = (selector.match(/#[^\s\+>~\.\[:]+/g) || []).length;
    const classes = (selector.match(/\.[^\s\+>~\.\[:]+/g) || []).length;
    const attributes = (selector.match(/\[[^\]]+\]/g) || []).length;
    const pseudoClasses = (selector.match(/:[^\s\+>~\.\[:]+/g) || []).length;
    const elements = (selector.match(/[^\s\+>~\.\[:]+/g) || []).length;
    
    return ids * 100 + (classes + attributes + pseudoClasses) * 10 + elements;
  }

  /**
   * Enhanced resource serialization
   */
  private serializeResourcesEnhanced(): EnhancedResource[] {
    const resources: EnhancedResource[] = [];
    const processedUrls = new Set<string>();

    // Process images
    document.querySelectorAll('img').forEach(img => {
      if (!processedUrls.has(img.src)) {
        processedUrls.add(img.src);
        resources.push(this.createImageResource(img));
      }
    });

    // Process fonts (from CSS)
    // This is complex - would need to parse CSS for @font-face rules

    // Process performance entries for additional resources
    if ('performance' in window && performance.getEntriesByType) {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      resourceEntries.forEach(entry => {
        if (!processedUrls.has(entry.name)) {
          processedUrls.add(entry.name);
          resources.push(this.createResourceFromPerformanceEntry(entry));
        }
      });
    }

    return resources;
  }

  /**
   * Create enhanced resource info from image element
   */
  private createImageResource(img: HTMLImageElement): EnhancedResource {
    return {
      url: img.src,
      type: 'image',
      dimensions: {
        width: img.naturalWidth,
        height: img.naturalHeight
      },
      size: undefined, // Would need to be calculated
      failed: !img.complete || img.naturalWidth === 0
    };
  }

  /**
   * Create resource from performance entry
   */
  private createResourceFromPerformanceEntry(entry: PerformanceResourceTiming): EnhancedResource {
    const resource: EnhancedResource = {
      url: entry.name,
      type: this.inferResourceType(entry.name),
      size: entry.transferSize,
      loadTime: entry.responseEnd - entry.requestStart,
      fromCache: entry.transferSize === 0 && entry.decodedBodySize > 0
    };

    return resource;
  }

  /**
   * Enhanced mutation handling
   */
  private handleEnhancedMutations(mutations: MutationRecord[]): void {
    mutations.forEach(mutation => {
      const change: EnhancedDOMChange = {
        timestamp: Date.now(),
        type: mutation.type as any,
        target: this.getNodeId(mutation.target),
        oldValue: mutation.oldValue || undefined,
        renderingTime: performance.now()
      };

      // Enhanced processing based on mutation type
      switch (mutation.type) {
        case 'childList':
          if (mutation.addedNodes.length > 0) {
            change.addedNodes = Array.from(mutation.addedNodes)
              .map(node => this.serializeNodeEnhanced(node))
              .filter((node): node is EnhancedSerializedNode => node !== null);
          }
          if (mutation.removedNodes.length > 0) {
            change.removedNodes = Array.from(mutation.removedNodes)
              .map(node => this.getNodeId(node))
              .filter(id => id !== undefined);
          }
          break;
          
        case 'attributes':
          change.attributeName = mutation.attributeName || undefined;
          if (mutation.target instanceof Element) {
            change.attributeValue = mutation.target.getAttribute(mutation.attributeName!) || undefined;
            
            // Special handling for class and style changes
            if (mutation.attributeName === 'class') {
              change.classChanges = this.analyzeClassChanges(mutation.oldValue, change.attributeValue);
            } else if (mutation.attributeName === 'style') {
              change.styleChanges = this.analyzeStyleChanges(mutation.target as Element);
            }
          }
          break;
      }

      // Analyze visual impact
      change.visualChange = this.analyzeVisualImpact(mutation);
      
      this.onDOMChange?.(change);
    });
  }

  // ... Additional helper methods for performance tracking, style analysis, etc.

  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'layout-shift') {
            this.layoutShiftEntries.push(entry as any);
          }
        });
      });
      
      this.performanceObserver.observe({ 
        entryTypes: ['layout-shift', 'paint', 'measure'] 
      });
    }
  }

  private setupStylesheetTracking(): void {
    // Monitor for dynamically added stylesheets
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
            // Track new stylesheet
            console.log('New stylesheet added:', node.href);
          } else if (node instanceof HTMLStyleElement) {
            // Track new style element
            console.log('New style element added');
          }
        });
      });
    });

    observer.observe(document.head, { childList: true });
  }

  private capturePerformanceMetrics() {
    if (!('performance' in window)) return undefined;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
      loadComplete: navigation?.loadEventEnd || 0,
      paintTimings: paint.reduce((acc, entry) => {
        acc[entry.name] = entry.startTime;
        return acc;
      }, {} as Record<string, number>),
      layoutShifts: [...this.layoutShiftEntries],
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
    };
  }

  private captureEnvironmentInfo(): {
    userAgent: string;
    language: string;
    timezone: string;
    colorScheme: 'light' | 'dark';
    reducedMotion: boolean;
  } {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' as const : 'light' as const,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }

  // ... More helper methods would be implemented here

  private shouldIgnoreNode(_node: Node): boolean {
    // Enhanced node filtering logic
    return false;
  }

  private getNodeType(node: Node): EnhancedSerializedNode['type'] {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: return 'element';
      case Node.TEXT_NODE: return 'text';
      case Node.COMMENT_NODE: return 'comment';
      case Node.DOCUMENT_NODE: return 'document';
      case Node.DOCUMENT_TYPE_NODE: return 'doctype';
      default: return 'element';
    }
  }

  private getNodeId(node: Node): number {
    if (!this.nodeIdMap.has(node)) {
      const id = this.nextNodeId++;
      this.nodeIdMap.set(node, id);
      this.nodeMap.set(id, node);
    }
    return this.nodeIdMap.get(node)!;
  }

  private serializeDoctype(doctype: DocumentType): EnhancedSerializedNode {
    return {
      id: this.getNodeId(doctype),
      type: 'doctype',
      tagName: 'DOCTYPE',
      attributes: {
        name: doctype.name,
        publicId: doctype.publicId,
        systemId: doctype.systemId
      }
    };
  }

  private serializeAttributesEnhanced(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name.toLowerCase();
      
      if (this.shouldIgnoreAttribute(name, attr.value)) {
        continue;
      }

      if (this.shouldMaskAttribute(name, element)) {
        attributes[name] = '[Masked]';
      } else {
        attributes[name] = attr.value;
      }
    }

    return attributes;
  }

  private serializeChildrenEnhanced(element: Element): EnhancedSerializedNode[] {
    const children: EnhancedSerializedNode[] = [];
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      const serialized = this.serializeNodeEnhanced(child);
      
      if (serialized) {
        children.push(serialized);
      }
    }

    return children;
  }

  private shouldMaskText(textNode: Text): boolean {
    const parent = textNode.parentElement;
    if (!parent) return false;
    
    const tagName = parent.tagName?.toLowerCase();
    const type = (parent as HTMLInputElement).type?.toLowerCase();
    
    return (tagName === 'input' && type === 'password') ||
           parent.hasAttribute('data-sensitive') ||
           parent.closest('[data-sensitive]') !== null;
  }

  private isFormElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    return ['input', 'textarea', 'select'].includes(tagName);
  }

  private shouldIgnoreAttribute(name: string, value: string): boolean {
    // Ignore script event handlers and other potentially sensitive attributes
    return name.startsWith('on') || name === 'style' && value.length > 1000;
  }

  private shouldMaskAttribute(name: string, element: Element): boolean {
    return (name === 'value' && (element as HTMLInputElement).type === 'password') ||
           element.hasAttribute('data-sensitive');
  }

  private handleResizeChanges(entries: ResizeObserverEntry[]): void {
    // Handle viewport or element resize changes
    entries.forEach(entry => {
      const change: EnhancedDOMChange = {
        timestamp: Date.now(),
        type: 'attributes',
        target: this.getNodeId(entry.target),
        attributeName: 'resize',
        renderingTime: performance.now(),
        visualChange: {
          affectedArea: entry.contentRect,
          significance: 'moderate'
        }
      };
      
      this.onDOMChange?.(change);
    });
  }

  private analyzeClassChanges(oldValue: string | null, newValue: string | undefined) {
    const oldClasses = oldValue ? oldValue.split(/\s+/).filter(Boolean) : [];
    const newClasses = newValue ? newValue.split(/\s+/).filter(Boolean) : [];
    
    const added = newClasses.filter(cls => !oldClasses.includes(cls));
    const removed = oldClasses.filter(cls => !newClasses.includes(cls));
    
    return { added, removed };
  }

  private analyzeStyleChanges(_element: Element) {
    // This would compare previous and current computed styles
    // For now, return empty array
    return [];
  }

  private analyzeVisualImpact(mutation: MutationRecord): { affectedArea: DOMRect; significance: 'minor' | 'moderate' | 'major' } | undefined {
    // Analyze the visual significance of the mutation
    if (mutation.target instanceof Element) {
      const rect = mutation.target.getBoundingClientRect();
      return {
        affectedArea: rect,
        significance: rect.width * rect.height > 10000 ? 'major' : 
                     rect.width * rect.height > 1000 ? 'moderate' : 'minor'
      };
    }
    return undefined;
  }

  private extractCSSText(sheet: CSSStyleSheet): string {
    try {
      if (sheet.cssRules) {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      }
    } catch (error) {
      // CORS or other access issues
    }
    return '';
  }

  private estimateStylesheetSize(sheet: CSSStyleSheet): number {
    return this.extractCSSText(sheet).length;
  }

  private inferResourceType(url: string): EnhancedResource['type'] {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'otf':
        return 'font';
      case 'mp4':
      case 'webm':
      case 'ogg':
        return 'media';
      case 'js':
        return 'script';
      case 'css':
        return 'stylesheet';
      default:
        return 'fetch';
    }
  }
}