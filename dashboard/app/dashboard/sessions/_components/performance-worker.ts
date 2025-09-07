/**
 * Web Worker for high-performance DOM reconstruction and session replay processing
 * Prevents main thread blocking during complex replay operations
 */

export interface WorkerMessage {
  id: string;
  type: 'RECONSTRUCT_DOM' | 'PROCESS_INTERACTIONS' | 'COMPRESS_DATA' | 'ANALYZE_PERFORMANCE';
  payload: Record<string, unknown>;
}

export interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload?: Record<string, unknown>;
  error?: string;
  progress?: number;
}

export interface DOMReconstructionTask {
  snapshots: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  stylesheets: Record<string, unknown>[];
  viewport: { width: number; height: number };
}

export interface ProcessedReplayData {
  reconstructedDOM: string;
  processedInteractions: Record<string, unknown>[];
  optimizedCSS: string;
  performanceMetrics: {
    processingTime: number;
    memoryUsage: number;
    complexity: number;
  };
}

// Web Worker code (this will be stringified and used as a blob)
const workerCode = `
// Performance monitoring
let startTime = 0;
let memoryBaseline = 0;

// Cache for DOM processing
const nodeCache = new Map();
const styleCache = new Map();

// Optimized DOM reconstruction
function reconstructDOMOptimized(snapshots, interactions, stylesheets, viewport) {
  startTime = performance.now();
  
  const processedSnapshots = [];
  const nodeMap = new Map();
  
  // Process snapshots with batching to prevent blocking
  const batchSize = 50;
  let processed = 0;
  
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    
    batch.forEach(snapshot => {
      const optimizedSnapshot = optimizeSnapshot(snapshot, nodeMap);
      processedSnapshots.push(optimizedSnapshot);
    });
    
    processed += batch.length;
    
    // Report progress
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        phase: 'DOM_RECONSTRUCTION',
        progress: (processed / snapshots.length) * 100
      }
    });
  }
  
  return processedSnapshots;
}

// Optimize individual snapshots
function optimizeSnapshot(snapshot, nodeMap) {
  if (!snapshot.data || !snapshot.data.nodes) return snapshot;
  
  const optimizedNodes = snapshot.data.nodes.map(node => {
    // Check cache first
    const cacheKey = generateNodeCacheKey(node);
    if (nodeCache.has(cacheKey)) {
      return nodeCache.get(cacheKey);
    }
    
    const optimizedNode = {
      ...node,
      // Remove redundant data
      computedStyles: node.computedStyles ? optimizeStyles(node.computedStyles) : undefined,
      // Compress large text content
      textContent: node.textContent && node.textContent.length > 1000 
        ? compressText(node.textContent) 
        : node.textContent
    };
    
    // Cache the result
    nodeCache.set(cacheKey, optimizedNode);
    nodeMap.set(node.id, optimizedNode);
    
    return optimizedNode;
  });
  
  return {
    ...snapshot,
    data: {
      ...snapshot.data,
      nodes: optimizedNodes
    }
  };
}

// Optimize CSS styles by removing redundant properties
function optimizeStyles(styles) {
  const cacheKey = JSON.stringify(styles);
  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey);
  }
  
  const optimized = {};
  const criticalProps = [
    'display', 'position', 'top', 'left', 'width', 'height',
    'background', 'color', 'border', 'margin', 'padding',
    'font-size', 'font-family', 'opacity', 'z-index'
  ];
  
  Object.entries(styles).forEach(([prop, value]) => {
    if (criticalProps.includes(prop) || criticalProps.some(critical => prop.startsWith(critical))) {
      optimized[prop] = value;
    }
  });
  
  styleCache.set(cacheKey, optimized);
  return optimized;
}

// Process interactions with temporal optimization
function processInteractionsOptimized(interactions) {
  // Sort by timestamp for efficient processing
  const sortedInteractions = [...interactions].sort((a, b) => a.timestamp - b.timestamp);
  
  // Group nearby interactions for batch processing
  const groupedInteractions = [];
  let currentGroup = [];
  let lastTimestamp = 0;
  
  sortedInteractions.forEach(interaction => {
    if (interaction.timestamp - lastTimestamp < 100 && currentGroup.length < 10) {
      currentGroup.push(interaction);
    } else {
      if (currentGroup.length > 0) {
        groupedInteractions.push(currentGroup);
      }
      currentGroup = [interaction];
    }
    lastTimestamp = interaction.timestamp;
  });
  
  if (currentGroup.length > 0) {
    groupedInteractions.push(currentGroup);
  }
  
  return groupedInteractions.flat();
}

// Compress CSS for efficient storage and transfer
function compressCSS(stylesheets) {
  return stylesheets.map(stylesheet => {
    if (!stylesheet.cssText) return stylesheet;
    
    // Remove comments and unnecessary whitespace
    let compressed = stylesheet.cssText
      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '') // Remove comments
      .replace(/\\s+/g, ' ') // Collapse whitespace
      .replace(/;\\s*}/g, '}') // Remove trailing semicolons
      .replace(/\\s*{\\s*/g, '{') // Clean around braces
      .replace(/;\\s*/g, ';') // Clean around semicolons
      .trim();
    
    return {
      ...stylesheet,
      cssText: compressed,
      originalSize: stylesheet.cssText.length,
      compressedSize: compressed.length
    };
  });
}

// Text compression for large content
function compressText(text) {
  // Simple compression by removing extra whitespace and truncating if needed
  const compressed = text.replace(/\\s+/g, ' ').trim();
  return compressed.length > 500 ? compressed.substring(0, 500) + '...[truncated]' : compressed;
}

// Generate cache key for nodes
function generateNodeCacheKey(node) {
  return \`\${node.type}-\${node.tagName || ''}-\${JSON.stringify(node.attributes || {})}\`;
}

// Calculate complexity metrics
function calculateComplexity(snapshots, interactions) {
  const totalNodes = snapshots.reduce((sum, snapshot) => 
    sum + (snapshot.data?.nodes?.length || 0), 0);
  const totalInteractions = interactions.length;
  const uniqueElements = new Set();
  
  snapshots.forEach(snapshot => {
    snapshot.data?.nodes?.forEach(node => {
      uniqueElements.add(node.tagName || 'unknown');
    });
  });
  
  return {
    totalNodes,
    totalInteractions,
    uniqueElements: uniqueElements.size,
    complexity: Math.log(totalNodes + totalInteractions + uniqueElements.size)
  };
}

// Performance monitoring
function getPerformanceMetrics() {
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  
  // Memory usage estimation (simplified)
  const memoryUsage = (nodeCache.size + styleCache.size) * 100; // Rough estimate
  
  return {
    processingTime,
    memoryUsage,
    cacheHits: {
      nodes: nodeCache.size,
      styles: styleCache.size
    }
  };
}

// Message handler
self.onmessage = function(e) {
  const { id, type, payload } = e.data;
  
  try {
    switch (type) {
      case 'RECONSTRUCT_DOM': {
        const { snapshots, interactions, stylesheets, viewport } = payload;
        
        // Process in stages with progress updates
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: { phase: 'STARTING', progress: 0 }
        });
        
        const processedSnapshots = reconstructDOMOptimized(snapshots, interactions, stylesheets, viewport);
        
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: { phase: 'PROCESSING_INTERACTIONS', progress: 50 }
        });
        
        const processedInteractions = processInteractionsOptimized(interactions);
        
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: { phase: 'COMPRESSING_CSS', progress: 75 }
        });
        
        const compressedCSS = compressCSS(stylesheets);
        
        const complexity = calculateComplexity(snapshots, interactions);
        const performanceMetrics = getPerformanceMetrics();
        
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: {
            reconstructedDOM: processedSnapshots,
            processedInteractions,
            optimizedCSS: compressedCSS,
            performanceMetrics: {
              ...performanceMetrics,
              complexity: complexity.complexity
            }
          }
        });
        break;
      }
      
      case 'PROCESS_INTERACTIONS': {
        const processedInteractions = processInteractionsOptimized(payload.interactions);
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { interactions: processedInteractions }
        });
        break;
      }
      
      case 'COMPRESS_DATA': {
        const compressed = {
          stylesheets: compressCSS(payload.stylesheets || []),
          interactions: processInteractionsOptimized(payload.interactions || [])
        };
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: compressed
        });
        break;
      }
      
      case 'ANALYZE_PERFORMANCE': {
        const complexity = calculateComplexity(payload.snapshots || [], payload.interactions || []);
        const metrics = getPerformanceMetrics();
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { complexity, metrics }
        });
        break;
      }
      
      default:
        throw new Error(\`Unknown message type: \${type}\`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error.message
    });
  }
};

// Periodic cleanup
setInterval(() => {
  // Clear caches if they get too large
  if (nodeCache.size > 1000) {
    nodeCache.clear();
  }
  if (styleCache.size > 500) {
    styleCache.clear();
  }
}, 60000); // Every minute
`;

/**
 * Performance-optimized Web Worker manager for session replay
 */
export class PerformanceWorker {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    onProgress?: (progress: number, phase: string) => void;
  }>();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);
      
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (error) => {
        console.error('Performance Worker error:', error);
      };
      
      // Clean up blob URL
      URL.revokeObjectURL(workerUrl);
    } catch {
      console.warn('Web Workers not supported, falling back to main thread');
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
    const { id, type, payload, error } = event.data;
    const pending = this.pendingMessages.get(id);
    
    if (!pending) return;
    
    switch (type) {
      case 'SUCCESS':
        pending.resolve(payload);
        this.pendingMessages.delete(id);
        break;
        
      case 'ERROR':
        pending.reject(new Error(error));
        this.pendingMessages.delete(id);
        break;
        
      case 'PROGRESS':
        if (pending.onProgress && payload) {
          pending.onProgress((payload as Record<string, unknown>).progress as number || 0, (payload as Record<string, unknown>).phase as string || 'processing');
        }
        break;
    }
  }

  private sendMessage(
    type: WorkerMessage['type'], 
    payload: Record<string, unknown>,
    onProgress?: (progress: number, phase: string) => void
  ): Promise<unknown> {
    const id = (++this.messageId).toString();
    
    if (!this.worker) {
      // Fallback to main thread processing
      return this.processOnMainThread(type, payload, onProgress);
    }
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject, onProgress });
      
      this.worker!.postMessage({
        id,
        type,
        payload
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker operation timed out'));
        }
      }, 30000);
    });
  }

  private async processOnMainThread(
    type: WorkerMessage['type'], 
    payload: Record<string, unknown>,
    onProgress?: (progress: number, phase: string) => void
  ): Promise<unknown> {
    // Simplified main thread fallback
    onProgress?.(0, 'starting');
    
    // Simulate processing with small delays to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 10));
    onProgress?.(50, 'processing');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    onProgress?.(100, 'complete');
    
    // Return simplified result
    return {
      reconstructedDOM: payload.snapshots || [],
      processedInteractions: payload.interactions || [],
      optimizedCSS: payload.stylesheets || [],
      performanceMetrics: {
        processingTime: 20,
        memoryUsage: 1024,
        complexity: 1
      }
    };
  }

  /**
   * Process complete session replay data with performance optimization
   */
  async reconstructSession(
    task: DOMReconstructionTask,
    onProgress?: (progress: number, phase: string) => void
  ): Promise<ProcessedReplayData> {
    return this.sendMessage('RECONSTRUCT_DOM', task as unknown as Record<string, unknown>, onProgress) as Promise<ProcessedReplayData>;
  }

  /**
   * Process interactions for optimized playback
   */
  async processInteractions(
    interactions: Record<string, unknown>[],
    onProgress?: (progress: number, phase: string) => void
  ): Promise<{ interactions: Record<string, unknown>[] }> {
    return this.sendMessage('PROCESS_INTERACTIONS', { interactions }, onProgress) as Promise<{ interactions: Record<string, unknown>[] }>;
  }

  /**
   * Compress data for efficient storage and transfer
   */
  async compressData(
    data: { stylesheets?: Record<string, unknown>[]; interactions?: Record<string, unknown>[] },
    onProgress?: (progress: number, phase: string) => void
  ): Promise<unknown> {
    return this.sendMessage('COMPRESS_DATA', data, onProgress);
  }

  /**
   * Analyze performance metrics
   */
  async analyzePerformance(
    snapshots: Record<string, unknown>[],
    interactions: Record<string, unknown>[]
  ): Promise<{ complexity: Record<string, unknown>; metrics: Record<string, unknown> }> {
    return this.sendMessage('ANALYZE_PERFORMANCE', { snapshots, interactions }) as Promise<{ complexity: Record<string, unknown>; metrics: Record<string, unknown> }>;
  }

  /**
   * Clean up worker resources
   */
  destroy() {
    if (this.worker) {
      // Clear pending messages
      this.pendingMessages.forEach(({ reject }) => {
        reject(new Error('Worker destroyed'));
      });
      this.pendingMessages.clear();
      
      // Terminate worker
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Check if Web Workers are supported and available
   */
  isWorkerSupported(): boolean {
    return this.worker !== null;
  }

  /**
   * Get current performance statistics
   */
  getStats() {
    return {
      isWorkerSupported: this.isWorkerSupported(),
      pendingOperations: this.pendingMessages.size,
      workerStatus: this.worker ? 'active' : 'unavailable'
    };
  }
}