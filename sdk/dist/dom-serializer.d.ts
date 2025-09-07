import type { ReviConfig } from './types';
export interface SerializedNode {
    type: 'document' | 'element' | 'text' | 'comment';
    tagName?: string;
    attributes?: Record<string, string>;
    textContent?: string;
    children?: SerializedNode[];
    id?: number;
    parentId?: number;
}
export interface DOMSnapshot {
    timestamp: number;
    url: string;
    viewport: {
        width: number;
        height: number;
    };
    scroll: {
        x: number;
        y: number;
    };
    nodes: SerializedNode[];
    stylesheets: SerializedStylesheet[];
    resources: SerializedResource[];
}
export interface SerializedStylesheet {
    href?: string;
    cssText: string;
    disabled: boolean;
}
export interface SerializedResource {
    url: string;
    type: 'image' | 'font' | 'media';
    data?: string;
    failed?: boolean;
}
export interface DOMChange {
    timestamp: number;
    type: 'childList' | 'attributes' | 'characterData';
    target: number;
    addedNodes?: SerializedNode[];
    removedNodes?: number[];
    attributeName?: string;
    attributeValue?: string;
    oldValue?: string;
}
/**
 * Advanced DOM serializer for session replay with rrweb-like capabilities
 */
export declare class DOMSerializer {
    private config;
    private nodeIdMap;
    private nodeMap;
    private nextNodeId;
    private observer?;
    private isObserving;
    private onDOMChange?;
    constructor(config: ReviConfig);
    /**
     * Take a complete snapshot of the DOM
     */
    takeSnapshot(): DOMSnapshot;
    /**
     * Start observing DOM changes
     */
    startObserving(onDOMChange: (change: DOMChange) => void): void;
    /**
     * Stop observing DOM changes
     */
    stopObserving(): void;
    /**
     * Serialize the entire document
     */
    private serializeDocument;
    /**
     * Serialize a single DOM node
     */
    private serializeNode;
    /**
     * Serialize element attributes
     */
    private serializeAttributes;
    /**
     * Serialize element children
     */
    private serializeChildren;
    /**
     * Serialize all stylesheets
     */
    private serializeStylesheets;
    /**
     * Serialize resources (images, fonts, etc.)
     */
    private serializeResources;
    /**
     * Handle mutation events
     */
    private handleMutations;
    /**
     * Utility methods
     */
    private getNodeId;
    private getNodeType;
    private shouldIgnoreNode;
    private shouldIgnoreAttribute;
    private shouldMaskAttribute;
    private shouldMaskText;
    private shouldIgnoreResource;
}
//# sourceMappingURL=dom-serializer.d.ts.map