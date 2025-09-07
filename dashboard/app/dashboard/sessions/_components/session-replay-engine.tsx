'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useCSSReconstruction } from './css-reconstruction-engine';
import { PerformanceWorker } from './performance-worker';

// Enhanced interfaces for real DOM reconstruction
export interface SerializedDOMNode {
  id: number;
  type: 'element' | 'text' | 'comment' | 'document';
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: SerializedDOMNode[];
  parentId?: number;
  computedStyles?: Record<string, string>;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReplaySnapshot {
  timestamp: number;
  type: 'full_snapshot' | 'incremental_snapshot' | 'meta';
  data: {
    nodes?: SerializedDOMNode[];
    mutations?: DOMutation[];
    viewport?: { width: number; height: number };
    scroll?: { x: number; y: number };
  };
}

export interface DOMutation {
  type: 'childList' | 'attributes' | 'characterData' | 'style';
  target: number; // node ID
  addedNodes?: SerializedDOMNode[];
  removedNodes?: number[];
  attributeName?: string;
  attributeValue?: string;
  oldValue?: string;
  newStyles?: Record<string, string>;
}

export interface InteractionEvent {
  id: string;
  type: 'click' | 'input' | 'scroll' | 'hover' | 'focus' | 'blur' | 'keydown';
  timestamp: number;
  targetId: number;
  data: {
    x?: number;
    y?: number;
    value?: string;
    key?: string;
    scrollX?: number;
    scrollY?: number;
  };
}

interface SessionReplayEngineProps {
  snapshots: ReplaySnapshot[];
  interactions: InteractionEvent[];
  currentTime: number;
  viewport: { width: number; height: number };
  onReady?: () => void;
  className?: string;
}

export function SessionReplayEngine({
  snapshots,
  interactions,
  currentTime,
  viewport,
  onReady,
  className
}: SessionReplayEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const replayFrameRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [nodeMap, setNodeMap] = useState<Map<number, HTMLElement>>(new Map());
  const [activeInteraction, setActiveInteraction] = useState<InteractionEvent | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{ progress: number; phase: string } | null>(null);
  
  // Performance worker for heavy operations
  const performanceWorkerRef = useRef<PerformanceWorker | null>(null);
  
  // CSS reconstruction
  const { applyComputedStyles, createEngine } = useCSSReconstruction(replayFrameRef.current);

  // Initialize performance worker
  useEffect(() => {
    performanceWorkerRef.current = new PerformanceWorker();
    
    return () => {
      if (performanceWorkerRef.current) {
        performanceWorkerRef.current.destroy();
        performanceWorkerRef.current = null;
      }
    };
  }, []);

  // Initialize the replay iframe
  useEffect(() => {
    const iframe = replayFrameRef.current;
    if (!iframe) return;

    const initializeFrame = () => {
      try {
        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc) return;

        // Set up base HTML structure
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  background: #ffffff;
                  overflow: hidden;
                  position: relative;
                }
                .revi-cursor {
                  position: absolute;
                  width: 20px;
                  height: 20px;
                  pointer-events: none;
                  z-index: 999999;
                  transition: all 0.1s ease-out;
                }
                .revi-cursor::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 0;
                  height: 0;
                  border-left: 8px solid #ff4444;
                  border-right: 8px solid transparent;
                  border-bottom: 12px solid transparent;
                  border-top: 8px solid #ff4444;
                }
                .revi-click-ripple {
                  position: absolute;
                  border-radius: 50%;
                  background: rgba(255, 68, 68, 0.3);
                  pointer-events: none;
                  animation: rippleEffect 0.6s ease-out;
                  z-index: 999998;
                }
                @keyframes rippleEffect {
                  0% {
                    transform: scale(0);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(4);
                    opacity: 0;
                  }
                }
                .revi-highlight {
                  outline: 2px solid #ff4444 !important;
                  outline-offset: 2px !important;
                  transition: outline 0.2s ease-in-out !important;
                }
                .revi-input-highlight {
                  background-color: rgba(68, 255, 68, 0.1) !important;
                  transition: background-color 0.3s ease-in-out !important;
                }
                .revi-error-shake {
                  animation: errorShake 0.5s ease-in-out;
                }
                @keyframes errorShake {
                  0%, 20%, 40%, 60%, 80% { transform: translateX(-2px); }
                  10%, 30%, 50%, 70%, 90% { transform: translateX(2px); }
                  100% { transform: translateX(0); }
                }
              </style>
            </head>
            <body>
              <div id="revi-cursor" class="revi-cursor" style="display: none;">
                <div class="revi-cursor-trail"></div>
                <div class="revi-cursor-trail"></div>
                <div class="revi-cursor-trail"></div>
                <div class="revi-cursor-trail"></div>
                <div class="revi-cursor-trail"></div>
              </div>
            </body>
          </html>
        `);
        iframeDoc.close();

        setIsReady(true);
        onReady?.();
      } catch (error) {
        console.error('Failed to initialize replay frame:', error);
      }
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      initializeFrame();
    } else {
      iframe.onload = initializeFrame;
    }

    return () => {
      iframe.onload = null;
    };
  }, [onReady]);

  // Find the appropriate snapshot for current time
  const currentSnapshot = useMemo(() => {
    if (!snapshots.length) return null;
    
    // Find the last snapshot before or at current time
    let snapshot = snapshots[0];
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].timestamp <= currentTime) {
        snapshot = snapshots[i];
        break;
      }
    }
    
    return snapshot;
  }, [snapshots, currentTime]);

  // Find current interactions
  const currentInteractions = useMemo(() => {
    return interactions.filter(interaction => 
      Math.abs(interaction.timestamp - currentTime) <= 100 // Within 100ms
    );
  }, [interactions, currentTime]);

  // Reconstruct DOM from snapshot with performance optimization
  const reconstructDOM = useCallback(async (snapshot: ReplaySnapshot) => {
    const iframe = replayFrameRef.current;
    const worker = performanceWorkerRef.current;
    if (!iframe?.contentDocument || !isReady) return;

    const iframeDoc = iframe.contentDocument;
    const body = iframeDoc.body;

    try {
      setProcessingProgress({ progress: 0, phase: 'Starting DOM reconstruction' });

      // Clear previous content (keep cursor)
      const cursor = body.querySelector('#revi-cursor');
      body.innerHTML = '';
      if (cursor) body.appendChild(cursor);

      if (snapshot.data.nodes) {
        // Use performance worker for heavy processing if available
        if (worker && snapshot.data.nodes.length > 50) {
          try {
            await worker.reconstructSession(
              {
                snapshots: [snapshot as unknown as Record<string, unknown>],
                interactions: interactions as unknown as Record<string, unknown>[],
                stylesheets: [], // TODO: Add stylesheets from snapshot
                viewport
              },
              (progress, phase) => {
                setProcessingProgress({ progress, phase });
              }
            );

            // Use optimized data for reconstruction
            // Note: optimizedData.reconstructedDOM contains the processed HTML string
            // which can be used for enhanced DOM reconstruction if needed
            setProcessingProgress({ progress: 75, phase: 'Applying optimizations' });
          } catch (workerError) {
            console.warn('Performance worker failed, falling back to main thread:', workerError);
          }
        }

        // Build node map for quick lookup
        const newNodeMap = new Map<number, HTMLElement>();
        
        const createElementFromNode = (node: SerializedDOMNode): HTMLElement | Text | Comment | null => {
          try {
            switch (node.type) {
              case 'element': {
                const element = iframeDoc.createElement(node.tagName || 'div');
                
                // Apply attributes
                if (node.attributes) {
                  Object.entries(node.attributes).forEach(([name, value]) => {
                    if (name === 'style') {
                      element.setAttribute('style', value);
                    } else if (name.startsWith('data-') || 
                               ['id', 'class', 'src', 'href', 'alt', 'title', 'type', 'placeholder', 'value'].includes(name)) {
                      element.setAttribute(name, value);
                    }
                  });
                }

                // Apply computed styles if available using CSS reconstruction engine
                if (node.computedStyles) {
                  applyComputedStyles(element, node.computedStyles);
                }

                // Store in node map
                if (node.id) {
                  newNodeMap.set(node.id, element);
                }

                // Process children
                if (node.children) {
                  node.children.forEach(child => {
                    const childElement = createElementFromNode(child);
                    if (childElement) {
                      element.appendChild(childElement);
                    }
                  });
                }

                return element;
              }
              case 'text': {
                return iframeDoc.createTextNode(node.textContent || '');
              }
              case 'comment': {
                return iframeDoc.createComment(node.textContent || '');
              }
              default:
                return null;
            }
          } catch (error) {
            console.warn('Failed to create element from node:', node, error);
            return null;
          }
        };

        // Create DOM structure
        snapshot.data.nodes.forEach(node => {
          const element = createElementFromNode(node);
          if (element && element instanceof HTMLElement) {
            body.appendChild(element);
          }
        });

        setNodeMap(newNodeMap);
        setProcessingProgress({ progress: 90, phase: 'Finalizing DOM' });
      }

      // Apply viewport settings
      if (snapshot.data.viewport) {
        iframe.style.width = `${snapshot.data.viewport.width}px`;
        iframe.style.height = `${snapshot.data.viewport.height}px`;
      }

      // Apply scroll position
      if (snapshot.data.scroll) {
        iframeDoc.documentElement.scrollLeft = snapshot.data.scroll.x;
        iframeDoc.documentElement.scrollTop = snapshot.data.scroll.y;
      }

      setProcessingProgress({ progress: 100, phase: 'Complete' });
      
      // Clear progress after a short delay
      setTimeout(() => {
        setProcessingProgress(null);
      }, 1000);

    } catch (error) {
      console.error('Failed to reconstruct DOM:', error);
      setProcessingProgress(null);
    }
  }, [isReady, interactions, viewport, applyComputedStyles]);

  // Apply interactions (cursor, clicks, highlights)
  const applyInteractions = useCallback((interactions: InteractionEvent[]) => {
    const iframe = replayFrameRef.current;
    if (!iframe?.contentDocument || !isReady) return;

    const iframeDoc = iframe.contentDocument;
    const cursor = iframeDoc.getElementById('revi-cursor');

    interactions.forEach(interaction => {
      switch (interaction.type) {
        case 'click': {
          if (interaction.data.x !== undefined && interaction.data.y !== undefined) {
            // Use enhanced cursor positioning with trail effects
            const engine = createEngine();
            if (engine) {
              engine.updateCursorPosition(interaction.data.x, interaction.data.y);
              // setCurrentCursor({ x: interaction.data.x, y: interaction.data.y });
            } else if (cursor) {
              // Fallback to basic positioning
              cursor.style.display = 'block';
              cursor.style.left = `${interaction.data.x}px`;
              cursor.style.top = `${interaction.data.y}px`;
              // setCurrentCursor({ x: interaction.data.x, y: interaction.data.y });
            }

            // Create click ripple effect
            const ripple = iframeDoc.createElement('div');
            ripple.className = 'revi-click-ripple';
            ripple.style.left = `${interaction.data.x - 20}px`;
            ripple.style.top = `${interaction.data.y - 20}px`;
            ripple.style.width = '40px';
            ripple.style.height = '40px';
            iframeDoc.body.appendChild(ripple);

            // Remove ripple after animation
            setTimeout(() => {
              if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
              }
            }, 600);

            // Highlight clicked element
            const targetElement = nodeMap.get(interaction.targetId);
            if (targetElement) {
              targetElement.classList.add('revi-highlight');
              setTimeout(() => {
                targetElement.classList.remove('revi-highlight');
              }, 1000);
            }
          }
          break;
        }
        case 'input': {
          const targetElement = nodeMap.get(interaction.targetId);
          if (targetElement && (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement)) {
            targetElement.classList.add('revi-input-highlight');
            if (interaction.data.value !== undefined) {
              targetElement.value = interaction.data.value;
            }
            setTimeout(() => {
              targetElement.classList.remove('revi-input-highlight');
            }, 500);
          }
          break;
        }
        case 'hover': {
          if (interaction.data.x !== undefined && interaction.data.y !== undefined && cursor) {
            cursor.style.display = 'block';
            cursor.style.left = `${interaction.data.x}px`;
            cursor.style.top = `${interaction.data.y}px`;
            // setCurrentCursor({ x: interaction.data.x, y: interaction.data.y });
          }
          break;
        }
        case 'scroll': {
          if (interaction.data.scrollX !== undefined && interaction.data.scrollY !== undefined) {
            iframeDoc.documentElement.scrollLeft = interaction.data.scrollX;
            iframeDoc.documentElement.scrollTop = interaction.data.scrollY;
          }
          break;
        }
      }
    });

    setActiveInteraction(interactions[0] || null);
  }, [isReady, nodeMap, createEngine]);

  // Update replay based on current time
  useEffect(() => {
    if (currentSnapshot) {
      reconstructDOM(currentSnapshot);
    }
  }, [currentSnapshot, reconstructDOM]);

  useEffect(() => {
    if (currentInteractions.length > 0) {
      applyInteractions(currentInteractions);
    }
  }, [currentInteractions, applyInteractions]);

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div 
          ref={containerRef}
          className="relative w-full bg-gray-100 rounded-lg overflow-hidden"
          style={{ 
            height: `${Math.max(400, viewport.height * 0.8)}px`,
            aspectRatio: `${viewport.width}/${viewport.height}`
          }}
        >
          {/* Browser Chrome */}
          <div className="bg-gray-200 h-8 flex items-center px-3 text-xs text-gray-600 border-b">
            <div className="flex items-center gap-2 mr-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="bg-white px-3 py-1 rounded flex-1 text-gray-500">
              🔒 https://yourapp.com/dashboard
            </div>
          </div>

          {/* Replay Frame */}
          <iframe
            ref={replayFrameRef}
            className="w-full h-full border-0 bg-white"
            style={{ 
              height: 'calc(100% - 32px)',
              transform: viewport.width > 1200 ? 'scale(0.8)' : 'scale(1)',
              transformOrigin: 'top left'
            }}
            sandbox="allow-same-origin allow-scripts"
            title="Session Replay"
          />

          {/* Loading Overlay */}
          {!isReady && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Reconstructing session...</p>
              </div>
            </div>
          )}

          {/* Processing Progress Overlay */}
          {processingProgress && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    <div 
                      className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent transition-all duration-300"
                      style={{ 
                        transform: `rotate(${(processingProgress.progress / 100) * 360}deg)` 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-600">
                        {Math.round(processingProgress.progress)}%
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Processing Session Replay</h3>
                  <p className="text-sm text-gray-600">{processingProgress.phase}</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Interaction Info Overlay */}
          {activeInteraction && (
            <div className="absolute top-12 right-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded text-xs">
              <div className="font-medium capitalize">{activeInteraction.type}</div>
              {activeInteraction.data.value && (
                <div className="opacity-75">&quot;{activeInteraction.data.value}&quot;</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}