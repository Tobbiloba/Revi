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
  data?: string; // Base64 encoded data for small resources
  failed?: boolean;
}

export interface DOMChange {
  timestamp: number;
  type: 'childList' | 'attributes' | 'characterData';
  target: number; // Node ID
  addedNodes?: SerializedNode[];
  removedNodes?: number[]; // Node IDs
  attributeName?: string;
  attributeValue?: string;
  oldValue?: string;
}

/**
 * Advanced DOM serializer for session replay with rrweb-like capabilities
 */
export class DOMSerializer {
  private config: ReviConfig;
  private nodeIdMap = new WeakMap<Node, number>();
  private nodeMap = new Map<number, Node>();
  private nextNodeId = 1;
  private observer?: MutationObserver;
  private isObserving = false;
  private onDOMChange?: (change: DOMChange) => void;

  constructor(config: ReviConfig) {
    this.config = config;
  }

  /**
   * Take a complete snapshot of the DOM
   */
  takeSnapshot(): DOMSnapshot {
    const snapshot: DOMSnapshot = {
      timestamp: Date.now(),
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      },
      nodes: [],
      stylesheets: [],
      resources: []
    };

    // Serialize DOM
    snapshot.nodes = this.serializeDocument(document);
    
    // Capture stylesheets
    snapshot.stylesheets = this.serializeStylesheets();
    
    // Capture resources (images, fonts, etc.)
    snapshot.resources = this.serializeResources();

    return snapshot;
  }

  /**
   * Start observing DOM changes
   */
  startObserving(onDOMChange: (change: DOMChange) => void): void {
    if (this.isObserving) return;

    this.onDOMChange = onDOMChange;
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    
    this.observer.observe(document, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true
    });

    this.isObserving = true;
  }

  /**
   * Stop observing DOM changes
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    this.isObserving = false;
    this.onDOMChange = undefined;
  }

  /**
   * Serialize the entire document
   */
  private serializeDocument(doc: Document): SerializedNode[] {
    const doctype = doc.doctype;
    const nodes: SerializedNode[] = [];

    // Add doctype if present
    if (doctype) {
      nodes.push({
        type: 'document',
        tagName: 'DOCTYPE',
        attributes: {
          name: doctype.name,
          publicId: doctype.publicId,
          systemId: doctype.systemId
        },
        id: this.getNodeId(doctype)
      });
    }

    // Serialize document element (html)
    if (doc.documentElement) {
      const serialized = this.serializeNode(doc.documentElement);
      if (serialized) {
        nodes.push(serialized);
      }
    }

    return nodes;
  }

  /**
   * Serialize a single DOM node
   */
  private serializeNode(node: Node): SerializedNode | null {
    if (this.shouldIgnoreNode(node)) {
      return null;
    }

    const nodeId = this.getNodeId(node);
    const serialized: SerializedNode = {
      type: this.getNodeType(node),
      id: nodeId
    };

    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        const element = node as Element;
        serialized.tagName = element.tagName.toLowerCase();
        serialized.attributes = this.serializeAttributes(element);
        serialized.children = this.serializeChildren(element);
        break;

      case Node.TEXT_NODE:
        const textNode = node as Text;
        serialized.textContent = this.shouldMaskText(textNode) ? '[Masked]' : textNode.textContent || '';
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
   * Serialize element attributes
   */
  private serializeAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name.toLowerCase();
      
      // Skip sensitive attributes
      if (this.shouldIgnoreAttribute(name, attr.value)) {
        continue;
      }

      // Mask sensitive values
      if (this.shouldMaskAttribute(name, element)) {
        attributes[name] = '[Masked]';
      } else {
        attributes[name] = attr.value;
      }
    }

    return attributes;
  }

  /**
   * Serialize element children
   */
  private serializeChildren(element: Element): SerializedNode[] {
    const children: SerializedNode[] = [];
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      const serializedChild = this.serializeNode(child);
      
      if (serializedChild) {
        children.push(serializedChild);
      }
    }

    return children;
  }

  /**
   * Serialize all stylesheets
   */
  private serializeStylesheets(): SerializedStylesheet[] {
    const stylesheets: SerializedStylesheet[] = [];

    for (let i = 0; i < document.styleSheets.length; i++) {
      const stylesheet = document.styleSheets[i];
      
      try {
        let cssText = '';
        
        if (stylesheet.href) {
          // External stylesheet - we'll capture the URL
          // In production, you might want to fetch and inline the CSS
          cssText = `/* External stylesheet: ${stylesheet.href} */`;
        } else {
          // Inline stylesheet - capture the rules
          if (stylesheet.cssRules) {
            const rules = Array.from(stylesheet.cssRules);
            cssText = rules.map(rule => rule.cssText).join('\n');
          }
        }

        stylesheets.push({
          href: stylesheet.href || undefined,
          cssText,
          disabled: stylesheet.disabled
        });
      } catch (error) {
        // CORS issues or other access problems
        if (stylesheet.href) {
          stylesheets.push({
            href: stylesheet.href,
            cssText: `/* Could not access stylesheet: ${stylesheet.href} */`,
            disabled: stylesheet.disabled
          });
        }
      }
    }

    return stylesheets;
  }

  /**
   * Serialize resources (images, fonts, etc.)
   */
  private serializeResources(): SerializedResource[] {
    const resources: SerializedResource[] = [];

    // Capture images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.src && !this.shouldIgnoreResource(img.src)) {
        resources.push({
          url: img.src,
          type: 'image',
          failed: !img.complete || img.naturalWidth === 0
        });
      }
    });

    // Capture background images from computed styles
    const elementsWithBackgrounds = document.querySelectorAll('*');
    elementsWithBackgrounds.forEach(element => {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      
      if (backgroundImage && backgroundImage !== 'none') {
        const urlMatch = backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (urlMatch && urlMatch[1] && !this.shouldIgnoreResource(urlMatch[1])) {
          resources.push({
            url: urlMatch[1],
            type: 'image'
          });
        }
      }
    });

    return resources;
  }

  /**
   * Handle mutation events
   */
  private handleMutations(mutations: MutationRecord[]): void {
    mutations.forEach(mutation => {
      const targetId = this.nodeIdMap.get(mutation.target);
      if (!targetId) return;

      const change: DOMChange = {
        timestamp: Date.now(),
        type: mutation.type,
        target: targetId
      };

      switch (mutation.type) {
        case 'childList':
          if (mutation.addedNodes.length > 0) {
            change.addedNodes = Array.from(mutation.addedNodes)
              .map(node => this.serializeNode(node))
              .filter((node): node is SerializedNode => node !== null);
          }
          
          if (mutation.removedNodes.length > 0) {
            change.removedNodes = Array.from(mutation.removedNodes)
              .map(node => this.nodeIdMap.get(node))
              .filter((id): id is number => id !== undefined);
          }
          break;

        case 'attributes':
          change.attributeName = mutation.attributeName || undefined;
          if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            const element = mutation.target as Element;
            const value = element.getAttribute(mutation.attributeName || '');
            change.attributeValue = this.shouldMaskAttribute(
              mutation.attributeName || '', element
            ) ? '[Masked]' : value || '';
          }
          change.oldValue = mutation.oldValue || undefined;
          break;

        case 'characterData':
          change.attributeValue = this.shouldMaskText(mutation.target as Text) 
            ? '[Masked]' 
            : mutation.target.textContent || '';
          change.oldValue = mutation.oldValue || undefined;
          break;
      }

      if (this.onDOMChange) {
        this.onDOMChange(change);
      }
    });
  }

  /**
   * Utility methods
   */
  private getNodeId(node: Node): number {
    if (this.nodeIdMap.has(node)) {
      return this.nodeIdMap.get(node)!;
    }
    
    const id = this.nextNodeId++;
    this.nodeIdMap.set(node, id);
    this.nodeMap.set(id, node);
    
    return id;
  }

  private getNodeType(node: Node): SerializedNode['type'] {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        return 'element';
      case Node.TEXT_NODE:
        return 'text';
      case Node.COMMENT_NODE:
        return 'comment';
      case Node.DOCUMENT_NODE:
        return 'document';
      default:
        return 'element';
    }
  }

  private shouldIgnoreNode(node: Node): boolean {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Ignore script tags and other sensitive elements
      if (['script', 'noscript', 'meta'].includes(tagName)) {
        return true;
      }
      
      // Ignore elements with data-revi-ignore attribute
      if (element.hasAttribute('data-revi-ignore')) {
        return true;
      }
      
      // Ignore elements that match block selector
      if (this.config.replay?.blockSelector) {
        try {
          if (element.matches(this.config.replay.blockSelector)) {
            return true;
          }
        } catch (e) {
          // Invalid selector
        }
      }
    }
    
    return false;
  }

  private shouldIgnoreAttribute(name: string, value: string): boolean {
    // Ignore sensitive attributes
    const sensitiveAttrs = ['data-revi-ignore', 'data-password', 'data-sensitive'];
    return sensitiveAttrs.includes(name);
  }

  private shouldMaskAttribute(name: string, element: Element): boolean {
    if (!this.config.privacy?.maskInputs) return false;
    
    // Mask values of sensitive input fields
    if (element.tagName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const sensitiveTypes = ['password', 'email', 'tel'];
      if (sensitiveTypes.includes(input.type)) {
        return name === 'value';
      }
    }
    
    return false;
  }

  private shouldMaskText(textNode: Text): boolean {
    if (!this.config.replay?.maskAllText && !this.config.privacy?.maskInputs) {
      return false;
    }
    
    const parent = textNode.parentElement;
    if (!parent) return false;
    
    // Mask text in sensitive elements
    const sensitiveElements = ['input', 'textarea'];
    if (sensitiveElements.includes(parent.tagName.toLowerCase())) {
      return true;
    }
    
    // Check for mask selector
    if (this.config.replay?.maskSelector) {
      try {
        return parent.matches(this.config.replay.maskSelector);
      } catch (e) {
        return false;
      }
    }
    
    return this.config.replay?.maskAllText || false;
  }

  private shouldIgnoreResource(url: string): boolean {
    try {
      const urlObj = new URL(url, window.location.href);
      
      // Ignore data URLs (they're inline)
      if (urlObj.protocol === 'data:') return true;
      
      // Ignore very large images
      if (url.includes('?')) {
        const params = new URLSearchParams(urlObj.search);
        const width = params.get('w') || params.get('width');
        const height = params.get('h') || params.get('height');
        if (width && parseInt(width) > 2000) return true;
        if (height && parseInt(height) > 2000) return true;
      }
      
      return false;
    } catch (e) {
      return true; // Invalid URL
    }
  }
}