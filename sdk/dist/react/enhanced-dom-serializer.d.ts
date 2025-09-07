import type { ReviConfig } from './types';
export interface EnhancedSerializedNode {
    id: number;
    type: 'element' | 'text' | 'comment' | 'document' | 'doctype';
    tagName?: string;
    textContent?: string;
    attributes?: Record<string, string>;
    children?: EnhancedSerializedNode[];
    parentId?: number;
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
    interactionState?: {
        focused: boolean;
        hovered: boolean;
        pressed: boolean;
        disabled: boolean;
        checked?: boolean;
        selected?: boolean;
    };
    inputValue?: string;
    selectedOptions?: string[];
    scrollPosition?: {
        x: number;
        y: number;
    };
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
    performance?: {
        domContentLoaded: number;
        loadComplete: number;
        paintTimings: Record<string, number>;
        layoutShifts: any[];
        memoryUsage: number;
    };
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
    rules: ProcessedCSSRule[];
    loadTime?: number;
    size: number;
}
export interface ProcessedCSSRule {
    type: number;
    cssText: string;
    selectorText?: string;
    declarations?: CSSDeclaration[];
    media?: string;
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
    dimensions?: {
        width: number;
        height: number;
    };
    data?: string;
    failed?: boolean;
    blocked?: boolean;
}
export interface EnhancedDOMChange extends DOMChange {
    causedBy?: {
        type: 'user-interaction' | 'script' | 'network' | 'animation' | 'media-query';
        details?: any;
    };
    renderingTime?: number;
    layoutThrashing?: boolean;
    visualChange?: {
        affectedArea: DOMRect;
        significance: 'minor' | 'moderate' | 'major';
    };
}
export interface DOMChange {
    timestamp: number;
    type: 'childList' | 'attributes' | 'characterData' | 'style' | 'class' | 'dataset';
    target: number;
    addedNodes?: EnhancedSerializedNode[];
    removedNodes?: number[];
    attributeName?: string;
    attributeValue?: string;
    oldValue?: string;
    newValue?: string;
    styleChanges?: {
        property: string;
        oldValue: string;
        newValue: string;
        computed?: boolean;
    }[];
    classChanges?: {
        added: string[];
        removed: string[];
    };
}
/**
 * Enhanced DOM serializer with advanced styling, layout, and interaction capture
 */
export declare class EnhancedDOMSerializer {
    private nodeIdMap;
    private nodeMap;
    private nextNodeId;
    private observer?;
    private resizeObserver?;
    private isObserving;
    private onDOMChange?;
    private performanceObserver?;
    private layoutShiftEntries;
    private computedStyleCache;
    constructor(_config: ReviConfig);
    /**
     * Take an enhanced snapshot of the DOM with styling and layout information
     */
    takeEnhancedSnapshot(): EnhancedDOMSnapshot;
    /**
     * Start observing DOM changes with enhanced tracking
     */
    startEnhancedObserving(onDOMChange: (change: EnhancedDOMChange) => void): void;
    /**
     * Stop observing DOM changes
     */
    stopEnhancedObserving(): void;
    /**
     * Serialize document with enhanced information
     */
    private serializeDocumentEnhanced;
    /**
     * Serialize a single node with enhanced information
     */
    private serializeNodeEnhanced;
    /**
     * Capture comprehensive computed styles for an element
     */
    private captureComputedStyles;
    /**
     * Capture inline styles from the element's style attribute
     */
    private captureInlineStyles;
    /**
     * Capture visibility and display information
     */
    private captureVisibilityInfo;
    /**
     * Capture interaction state (focus, hover, etc.)
     */
    private captureInteractionState;
    /**
     * Capture form element values
     */
    private captureInputValue;
    /**
     * Capture selected options for select elements
     */
    private captureSelectedOptions;
    /**
     * Enhanced stylesheet serialization with processed rules
     */
    private serializeStylesheetsEnhanced;
    /**
     * Process a stylesheet and extract enhanced information
     */
    private processStylesheet;
    /**
     * Process individual CSS rules
     */
    private processCSSRule;
    /**
     * Extract CSS declarations from a CSSStyleDeclaration
     */
    private extractDeclarations;
    /**
     * Calculate CSS selector specificity
     */
    private calculateSpecificity;
    /**
     * Enhanced resource serialization
     */
    private serializeResourcesEnhanced;
    /**
     * Create enhanced resource info from image element
     */
    private createImageResource;
    /**
     * Create resource from performance entry
     */
    private createResourceFromPerformanceEntry;
    /**
     * Enhanced mutation handling
     */
    private handleEnhancedMutations;
    private setupPerformanceObserver;
    private setupStylesheetTracking;
    private capturePerformanceMetrics;
    private captureEnvironmentInfo;
    private shouldIgnoreNode;
    private getNodeType;
    private getNodeId;
    private serializeDoctype;
    private serializeAttributesEnhanced;
    private serializeChildrenEnhanced;
    private shouldMaskText;
    private isFormElement;
    private shouldIgnoreAttribute;
    private shouldMaskAttribute;
    private handleResizeChanges;
    private analyzeClassChanges;
    private analyzeStyleChanges;
    private analyzeVisualImpact;
    private extractCSSText;
    private estimateStylesheetSize;
    private inferResourceType;
}
//# sourceMappingURL=enhanced-dom-serializer.d.ts.map