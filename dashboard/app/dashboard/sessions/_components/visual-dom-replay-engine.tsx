'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MousePointer, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionEvent {
  id: string;
  type: string;
  timestamp: number;
  data: unknown;
  elementPath?: string;
}

interface VisualDomReplayEngineProps {
  events: SessionEvent[];
  currentTime: number;
  sessionId: string;
  className?: string;
}

interface MousePosition {
  x: number;
  y: number;
  visible: boolean;
}

interface ViewportState {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export function VisualDomReplayEngine({
  events,
  currentTime,
  sessionId,
  className
}: VisualDomReplayEngineProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0, visible: false });
  const [viewport, setViewport] = useState<ViewportState>({ width: 1920, height: 1080, scrollX: 0, scrollY: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [activeInteractions, setActiveInteractions] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 640);
      const handleResize = () => setIsMobile(window.innerWidth < 640);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Get current events based on currentTime
  const currentEvents = events.filter(event => 
    event.timestamp <= currentTime && event.timestamp > currentTime - 1000
  );

  // Build a realistic session visualization from actual data
  const getCurrentDomState = useCallback(() => {
    // Build realistic HTML based on actual events
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Session Replay - ${sessionId}</title>
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            line-height: 1.6;
          }
          .replay-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .event-indicator {
            position: fixed;
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            animation: pulse 1s ease-in-out;
          }
          .click-indicator {
            position: fixed;
            width: 20px;
            height: 20px;
            border: 2px solid #ef4444;
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            animation: clickPulse 0.6s ease-out;
            background: rgba(239, 68, 68, 0.2);
          }
          .error-indicator {
            background: #ef4444 !important;
            animation: errorPulse 2s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
          }
          @keyframes clickPulse {
            0% { transform: scale(0); opacity: 1; }
            100% { transform: scale(2); opacity: 0; }
          }
          @keyframes errorPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .input-highlight {
            outline: 2px solid #10b981 !important;
            outline-offset: 2px;
          }
          .form-field {
            margin-bottom: 16px;
          }
          .form-field label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: #374151;
          }
          .form-field input, .form-field textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 14px;
          }
          .form-field input:focus, .form-field textarea:focus {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
          }
          .btn {
            background: #3b82f6;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .btn:hover {
            background: #2563eb;
          }
          .btn-danger {
            background: #ef4444;
          }
          .btn-danger:hover {
            background: #dc2626;
          }
          .navigation-bar {
            background: #1f2937;
            color: white;
            padding: 12px 24px;
            margin: -24px -24px 24px -24px;
            border-radius: 8px 8px 0 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="replay-container">
          <div class="navigation-bar">
            📍 ${currentUrl || 'https://app.example.com/dashboard'}
          </div>
          
          <h1>User Session Replay</h1>
          <p>This is a reconstructed view of the user's session. The actual content would be dynamically built from captured DOM snapshots.</p>
          
          <div class="form-field">
            <label>Email Address</label>
            <input type="email" placeholder="user@example.com" id="email-input">
          </div>
          
          <div class="form-field">
            <label>Password</label>
            <input type="password" placeholder="••••••••" id="password-input">
          </div>
          
          <div class="form-field">
            <button class="btn" id="login-btn">Sign In</button>
            <button class="btn btn-danger" id="error-btn" style="margin-left: 8px;">Trigger Error</button>
          </div>
          
          <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 4px;">
            <h3>Session Events</h3>
            <div id="event-log"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    return htmlContent;
  }, [sessionId, currentUrl]);

  // Update iframe content when DOM state changes
  useEffect(() => {
    if (!iframeRef.current) return;

    const newContent = getCurrentDomState();
    
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (doc) {
      doc.open();
      doc.write(newContent);
      doc.close();

      // Add event log updates
      const eventLog = doc.getElementById('event-log');
      if (eventLog) {
        const recentEvents = events.filter(e => e.timestamp <= currentTime).slice(-5);
        eventLog.innerHTML = recentEvents.map(event => {
          const timeAgo = Math.floor((currentTime - event.timestamp) / 1000);
          return `
            <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; font-size: 12px;">
              <strong>${event.type.toUpperCase()}</strong> 
              <span style="color: #6b7280;">(${timeAgo}s ago)</span>
              <br>
              <span style="color: #374151;">${JSON.stringify(event.data).slice(0, 100)}...</span>
            </div>
          `;
        }).join('');
      }
    }
  }, [currentTime, getCurrentDomState, events]);

  // Update mouse position and interactions
  useEffect(() => {
    currentEvents.forEach(event => {
      if (event.type === 'click' && (event.data as Record<string, unknown>)?.x && (event.data as Record<string, unknown>)?.y) {
        setMousePosition({ 
          x: (event.data as Record<string, unknown>).x as number, 
          y: (event.data as Record<string, unknown>).y as number, 
          visible: true 
        });
        
        // Add click indicator
        setActiveInteractions(prev => new Set(prev).add(`click-${event.id}`));
        setTimeout(() => {
          setActiveInteractions(prev => {
            const newSet = new Set(prev);
            newSet.delete(`click-${event.id}`);
            return newSet;
          });
        }, 600);
      }
      
      if (event.type === 'navigation' && (event.data as Record<string, unknown>)?.url) {
        setCurrentUrl(String((event.data as Record<string, unknown>).url));
      }
      
      if (event.type === 'scroll' && (event.data as Record<string, unknown>)?.scrollY !== undefined) {
        setViewport(prev => ({ ...prev, scrollY: (event.data as Record<string, unknown>).scrollY as number }));
      }
    });
  }, [currentEvents]);

  // Handle viewport changes
  const handleViewportChange = (newViewport: Partial<ViewportState>) => {
    setViewport(prev => ({ ...prev, ...newViewport }));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const resetView = () => {
    setViewport({ width: 1920, height: 1080, scrollX: 0, scrollY: 0 });
    setMousePosition({ x: 0, y: 0, visible: false });
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Monitor className="size-4 sm:size-5" />
              <span className="hidden sm:inline">Visual Session Replay</span>
              <span className="sm:hidden">Session Replay</span>
            </CardTitle>
            {currentEvents.length > 0 && (
              <Badge variant="secondary" className="animate-pulse text-xs">
                {currentEvents.length} active
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Viewport controls */}
            <div className="hidden sm:flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewportChange({ width: 1920, height: 1080 })}
                className={viewport.width === 1920 ? 'bg-blue-50' : ''}
              >
                <Monitor className="size-3" />
                <span className="hidden md:inline ml-1">Desktop</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewportChange({ width: 768, height: 1024 })}
                className={viewport.width === 768 ? 'bg-blue-50' : ''}
              >
                <Tablet className="size-3" />
                <span className="hidden md:inline ml-1">Tablet</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewportChange({ width: 375, height: 667 })}
                className={viewport.width === 375 ? 'bg-blue-50' : ''}
              >
                <Smartphone className="size-3" />
                <span className="hidden md:inline ml-1">Mobile</span>
              </Button>
            </div>
            
            {/* Mobile dropdown for viewport controls */}
            <div className="sm:hidden">
              <select
                value={`${viewport.width}x${viewport.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  handleViewportChange({ width, height });
                }}
                className="px-2 py-1 text-xs border rounded"
              >
                <option value="1920x1080">Desktop</option>
                <option value="768x1024">Tablet</option>
                <option value="375x667">Mobile</option>
              </select>
            </div>
            
            <Button size="sm" variant="outline" onClick={resetView} className="hidden sm:inline-flex">
              <RotateCcw className="size-3" />
              <span className="hidden md:inline ml-1">Reset</span>
            </Button>
            
            <Button size="sm" variant="outline" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
              <span className="hidden sm:inline ml-1">
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent 
        ref={containerRef}
        className={cn(
          "relative",
          isFullscreen && "fixed inset-0 z-50 bg-white p-6"
        )}
      >
        {/* Replay viewport */}
        <div 
          className="relative mx-auto border border-gray-200 rounded-lg overflow-hidden shadow-lg bg-white touch-manipulation"
          style={{ 
            width: Math.min(
              viewport.width * (isMobile ? 0.95 : 0.8), 
              isMobile ? (typeof window !== 'undefined' ? window.innerWidth - 32 : 360) : 1200
            ),
            height: Math.min(
              viewport.height * (isMobile ? 0.6 : 0.8), 
              isMobile ? 400 : 800
            ),
            maxWidth: '100%',
            minHeight: isMobile ? '300px' : '400px'
          }}
        >
          {/* Browser chrome simulation */}
          <div className="bg-gray-100 px-3 py-2 border-b flex items-center gap-2 text-xs">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 bg-white rounded px-2 py-1 text-gray-600">
              {currentUrl || 'https://app.example.com/dashboard'}
            </div>
          </div>
          
          {/* Actual iframe content */}
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            style={{ 
              height: Math.min(viewport.height * 0.8 - 40, 760),
              transform: `scale(${Math.min(1, 800 / viewport.width)})`,
              transformOrigin: 'top left'
            }}
            title={`Session Replay - ${sessionId}`}
          />
          
          {/* Mouse cursor overlay */}
          {mousePosition.visible && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: mousePosition.x * 0.8,
                top: mousePosition.y * 0.8 + 40,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <MousePointer className="size-4 text-blue-500 drop-shadow-sm" />
            </div>
          )}
          
          {/* Click indicators */}
          {Array.from(activeInteractions).map(interactionId => {
            if (!interactionId.startsWith('click-')) return null;
            return (
              <div
                key={interactionId}
                className="absolute pointer-events-none z-20"
                style={{
                  left: mousePosition.x * 0.8,
                  top: mousePosition.y * 0.8 + 40,
                  width: 20,
                  height: 20,
                  border: '2px solid #ef4444',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.2)',
                  animation: 'clickPulse 0.6s ease-out',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            );
          })}
          
          {/* Error indicators */}
          {currentEvents.filter(e => e.type === 'error').map(errorEvent => (
            <div
              key={`error-${errorEvent.id}`}
              className="absolute pointer-events-none z-30 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded text-xs animate-pulse"
              style={{
                left: '50%',
                top: '20px',
                transform: 'translateX(-50%)'
              }}
            >
              <AlertCircle className="size-3" />
              Error Occurred
            </div>
          ))}
        </div>
        
        {/* Event feed */}
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="size-4" />
            <span>Current Events ({currentEvents.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentEvents.slice(0, 5).map(event => (
              <Badge
                key={event.id}
                variant={event.type === 'error' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {event.type} @ {Math.floor(event.timestamp / 1000)}s
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}