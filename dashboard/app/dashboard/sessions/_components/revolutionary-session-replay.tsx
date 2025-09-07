'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Eye, 
  Activity, 
  AlertTriangle, 
  Clock,
  Sparkles,
  Zap,
  Target,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ReplaySnapshot, type InteractionEvent } from './session-replay-engine';
import { CinematicReplayControls } from './cinematic-replay-controls';
import { useSessionEvents } from '@/lib/hooks/useReviData';
import { usePollingSession } from '@/lib/hooks/usePollingSession';
import { useErrorCorrelation, type ErrorEvent as CorrelationErrorEvent, type InteractionEvent as CorrelationInteractionEvent } from './error-correlation-engine';
import { MobileResponsiveEnhancements, useResponsiveDetection } from './mobile-responsive-enhancements';
import { RealisticSessionAnalyzer } from './realistic-session-analyzer';

interface SessionError {
  id: string;
  timestamp: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stack?: string;
  url?: string;
}

interface SessionMetadata {
  sessionId: string;
  userId?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  duration: number;
  pageViews: number;
  interactions: number;
  errors: number;
  startUrl: string;
  endUrl?: string;
}

interface RevolutionarySessionReplayProps {
  sessionId: string;
  className?: string;
}

// Helper function to generate empty session data structure
const createEmptySessionData = (sessionId: string) => ({
  metadata: {
    sessionId,
    userId: undefined,
    userAgent: '',
    viewport: { width: 1920, height: 1080 },
    duration: 0,
    pageViews: 0,
    interactions: 0,
    errors: 0,
    startUrl: '',
    endUrl: undefined
  },
  snapshots: [] as ReplaySnapshot[],
  interactions: [] as InteractionEvent[],
  errors: [] as SessionError[],
  events: [],
  duration: 0,
  startTime: Date.now()
});

export function RevolutionarySessionReplay({ sessionId, className }: RevolutionarySessionReplayProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('replay');
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const replayIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load real session data from backend
  const { data: backendSessionData, isLoading, error } = useSessionEvents(sessionId);

  // Real-time polling session data
  const pollingApiKey = process.env.NEXT_PUBLIC_REVI_API_KEY || 'revi_00fc53de2167a76e720d4c99a183ceae9ca8937b86d1ecaac0a865e867d5941e';
  const pollingApiUrl = process.env.NEXT_PUBLIC_REVI_API_URL || 'http://localhost:4000';
  
  const { sessionData: pollingData, isPolling } = usePollingSession(sessionId, pollingApiKey, pollingApiUrl);

  // Error correlation for visual error highlighting (stabilized to prevent hooks order issues)
  const [stableIframe, setStableIframe] = useState<HTMLIFrameElement | null>(null);
  
  useEffect(() => {
    if (replayIframeRef.current !== stableIframe) {
      setStableIframe(replayIframeRef.current);
    }
  }, [stableIframe]);
  
  const { correlations, activeErrorId, addError, addInteraction, highlightError } = useErrorCorrelation(stableIframe);

  // Responsive detection for mobile optimization
  const { isMobile, isTouchDevice } = useResponsiveDetection();
  
  // Create session data from real backend and streaming data
  const sessionData = useMemo(() => {
    // Merge backend data with streaming data for complete session view
    let allEvents: { id: string; type: string; timestamp: number; data?: unknown }[] = [];
    let allErrors: { id: string; message: string; timestamp: number }[] = [];
    let sessionStartTime = Date.now();
    let sessionDuration = 0;

    // Use Map to track unique events and prevent duplicates
    const uniqueEventsMap = new Map();

    // Add backend data with proper transformation
    if (backendSessionData?.events && backendSessionData.events.length > 0) {
      const transformedEvents = backendSessionData.events.map(event => ({
        id: event.id.toString(),
        type: event.event_type as string,
        timestamp: event.timestamp.getTime(),
        data: typeof event.data === 'string' ? JSON.parse(event.data as string) : event.data,
        severity: event.source === 'error' ? 'high' : undefined,
        source: event.source || 'backend',
        uniqueKey: `backend-${event.id}-${event.timestamp.getTime()}`,
        elementPath: (event.data as Record<string, unknown>)?.elementPath || (event.data as Record<string, unknown>)?.selector || undefined
      }));
      
      // Add to unique map to prevent duplicates
      transformedEvents.forEach(event => {
        if (!uniqueEventsMap.has(event.uniqueKey)) {
          uniqueEventsMap.set(event.uniqueKey, event);
        }
      });
      
      // Calculate session timing from backend data
      const timestamps = transformedEvents.map(e => e.timestamp);
      if (timestamps.length > 0) {
        sessionStartTime = Math.min(...timestamps);
        sessionDuration = Math.max(...timestamps) - sessionStartTime;
      }
    }

    // Add polling data for real-time updates (avoid duplicates)
    if (pollingData.events.length > 0) {
      const pollingEvents = pollingData.events.map(event => ({
        id: event.id.toString(),
        type: event.type as string,
        timestamp: event.timestamp,
        data: event.data,
        severity: 'medium' as const,
        source: 'polling',
        uniqueKey: `polling-${event.id}-${event.timestamp}`
      }));
      
      // Only add if not already exists
      pollingEvents.forEach(event => {
        if (!uniqueEventsMap.has(event.uniqueKey)) {
          uniqueEventsMap.set(event.uniqueKey, event);
        }
      });
      
      // Update duration if polling data is newer
      const pollingTimestamps = pollingEvents.map(e => e.timestamp);
      if (pollingTimestamps.length > 0) {
        const maxPollingTime = Math.max(...pollingTimestamps);
        sessionDuration = Math.max(sessionDuration, maxPollingTime - sessionStartTime);
      }
    }

    // Add polling errors (avoid duplicates)
    if (pollingData.errors.length > 0) {
      const pollingErrors = pollingData.errors.map(error => ({
        id: error.id.toString(),
        type: 'error' as const,
        timestamp: error.timestamp,
        data: { message: (error.data as Record<string, unknown>)?.message as string || 'Unknown error', stack: (error.data as Record<string, unknown>)?.stack as string },
        severity: 'high' as const,
        source: 'polling-error',
        uniqueKey: `polling-error-${error.id}-${error.timestamp}`
      }));
      
      // Only add if not already exists
      pollingErrors.forEach(error => {
        if (!uniqueEventsMap.has(error.uniqueKey)) {
          uniqueEventsMap.set(error.uniqueKey, error);
        }
      });
      
      allErrors = [...allErrors, ...pollingData.errors.map(e => ({
        id: e.id.toString(),
        timestamp: e.timestamp,
        message: (e.data as Record<string, unknown>)?.message as string || 'Unknown error',
        severity: 'high' as const,
        stack: (e.data as Record<string, unknown>)?.stack as string,
        url: (e.data as Record<string, unknown>)?.url as string
      }))];
    }

    // Convert unique events map to array and sort by timestamp
    allEvents = Array.from(uniqueEventsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Transform events to interactions format
    const interactions: InteractionEvent[] = allEvents
      .filter(e => ['click', 'input', 'scroll', 'hover', 'focus', 'blur', 'keydown'].includes(e.type))
      .map(e => ({
        id: e.id,
        type: e.type as 'click' | 'input' | 'scroll' | 'hover' | 'focus' | 'blur' | 'keydown',
        timestamp: e.timestamp,
        targetId: (e.data as Record<string, unknown>)?.targetId as number || 0,
        data: e.data || {}
      }));

    // Extract errors
    const errorEvents: SessionError[] = [
      ...allErrors.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        message: e.message,
        severity: 'high' as const,
        stack: (e as unknown as {stack?: string}).stack || '',
        url: (e as unknown as {url?: string}).url || ''
      })),
      ...allEvents.filter(e => e.type === 'error').map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        message: (e.data as Record<string, unknown>)?.message as string || 'Unknown error',
        severity: (e as unknown as {severity?: string}).severity as 'high' | 'medium' | 'low' || ('medium' as const),
        stack: (e.data as Record<string, unknown>)?.stack as string || '',
        url: (e.data as Record<string, unknown>)?.url as string || ''
      }))
    ];

    // Create metadata from real data with proper fallbacks
    const sessionInfo = backendSessionData?.session_info;
    const sessionMetadata = sessionInfo?.metadata as Record<string, unknown> || {};
    
    const metadata: SessionMetadata = {
      sessionId,
      userId: sessionInfo?.user_id || `user_${sessionId.slice(-6)}`,
      userAgent: String((sessionMetadata as Record<string, unknown>)?.userAgent || (sessionMetadata as Record<string, unknown>)?.user_agent) || 'Mozilla/5.0 (Unknown)',
      viewport: (sessionMetadata?.viewport as { width: number; height: number }) || { width: 1920, height: 1080 },
      duration: sessionDuration || 0,
      pageViews: allEvents.filter(e => e.type === 'navigation' || e.type === 'page_load').length,
      interactions: interactions.length,
      errors: errorEvents.length,
      startUrl: String((sessionMetadata as Record<string, unknown>)?.startUrl || (sessionMetadata as Record<string, unknown>)?.url) || 'https://app.example.com',
      endUrl: pollingData.isLive ? undefined : String((sessionMetadata as Record<string, unknown>)?.endUrl) || undefined
    };

    // Generate basic snapshots from events (simplified for now)
    const snapshots: ReplaySnapshot[] = [];
    if (allEvents.length > 0) {
      snapshots.push({
        timestamp: sessionStartTime,
        type: 'full_snapshot',
        data: {
          nodes: [{
            id: 1,
            type: 'element',
            tagName: 'div',
            attributes: { class: 'session-replay-placeholder' },
            children: [{
              id: 2,
              type: 'text',
              textContent: 'Session Replay Data'
            }]
          }],
          viewport: metadata.viewport,
          scroll: { x: 0, y: 0 }
        }
      });
    }

    // Return empty session data if no events exist
    if (allEvents.length === 0 && !backendSessionData?.session_info) {
      return createEmptySessionData(sessionId);
    }

    return {
      metadata,
      events: allEvents.map(event => {
        // Map event types to valid SessionEvent types
        let eventType: 'input' | 'error' | 'click' | 'scroll' | 'navigation' | 'network' | 'resize' | 'blur' | 'focus';
        switch (event.type) {
          case 'input':
          case 'error':
          case 'click':
          case 'scroll':
          case 'navigation':
          case 'network':
          case 'resize':
          case 'blur':
          case 'focus':
            eventType = event.type;
            break;
          case 'page_load':
          case 'popstate':
          case 'pushstate':
            eventType = 'navigation';
            break;
          case 'keydown':
          case 'hover':
            eventType = 'input';
            break;
          default:
            eventType = 'input'; // Default fallback
        }
        
        return {
          ...event,
          type: eventType,
          data: event.data || {}
        };
      }),
      snapshots,
      interactions,
      errors: errorEvents,
      duration: sessionDuration,
      startTime: sessionStartTime
    };
  }, [backendSessionData, pollingData, sessionId]);

  const { metadata, interactions, errors, events, duration, startTime } = sessionData;

  // Feed errors and interactions to correlation engine
  useEffect(() => {
    // Add all errors to correlation engine
    errors.forEach(error => {
      const correlationError: CorrelationErrorEvent = {
        id: error.id,
        message: error.message,
        stack: (error as unknown as Record<string, unknown>).stack as string || '',
        timestamp: error.timestamp,
        url: (error as unknown as Record<string, unknown>).url as string || '',
        sessionId,
        metadata: {
          element: {
            tagName: 'div', // Mock data - in real implementation this would come from error context
            className: 'error-element',
            selector: '.error-element'
          }
        }
      };
      addError(correlationError);
    });

    // Add all interactions to correlation engine
    interactions.forEach(interaction => {
      // Map interaction type to supported correlation types
      let correlationType: 'click' | 'input' | 'scroll' | 'navigation' | 'focus' | 'blur' = 'click';
      if (['click', 'input', 'scroll', 'navigation', 'focus', 'blur'].includes(interaction.type)) {
        correlationType = interaction.type as 'click' | 'input' | 'scroll' | 'navigation' | 'focus' | 'blur';
      } else if (interaction.type === 'keydown' || interaction.type === 'hover') {
        correlationType = 'input'; // Map unsupported types to closest match
      }
      
      const correlationInteraction: CorrelationInteractionEvent = {
        id: interaction.id,
        type: correlationType,
        timestamp: interaction.timestamp,
        target: {
          tagName: (interaction.data as Record<string, unknown>)?.tagName as string || 'div',
          className: (interaction.data as Record<string, unknown>)?.className as string,
          id: (interaction.data as Record<string, unknown>)?.id as string,
          selector: (interaction.data as Record<string, unknown>)?.selector as string || `#${(interaction.data as Record<string, unknown>)?.id || 'unknown'}`
        },
        data: interaction.data
      };
      addInteraction(correlationInteraction);
    });

    // Also add events as interactions
    events.forEach(event => {
      if (['click', 'input', 'scroll', 'navigation', 'focus', 'blur'].includes(event.type)) {
        const correlationInteraction: CorrelationInteractionEvent = {
          id: event.id,
          type: event.type as 'click' | 'input' | 'scroll' | 'navigation' | 'focus' | 'blur',
          timestamp: event.timestamp,
          target: {
            tagName: (event.data as Record<string, unknown>)?.tagName as string || 'div',
            className: (event.data as Record<string, unknown>)?.className as string,
            id: (event.data as Record<string, unknown>)?.id as string,
            selector: (event.data as Record<string, unknown>)?.selector as string || `#${(event.data as Record<string, unknown>)?.id || 'unknown'}`
          },
          data: event.data
        };
        addInteraction(correlationInteraction);
      }
    });
  }, [errors, interactions, events, sessionId, addError, addInteraction]);

  // Playback control functions (moved before early returns to avoid hooks order issues)
  const handlePlay = useCallback(() => {
    console.log(`[PLAYBACK] Play button clicked - duration: ${duration}, events: ${events.length}`);
    setIsPlaying(true);
  }, [duration, events.length]);

  const handlePause = useCallback(() => {
    console.log(`[PLAYBACK] Pause button clicked`);
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    console.log(`[PLAYBACK] Stop button clicked`);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleSkipToEvent = useCallback((eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setCurrentTime(event.timestamp - startTime);
    }
  }, [events, startTime]);

  const handleExport = useCallback(() => {
    // Implement export functionality
    console.log('Exporting session replay...');
  }, []);

  const handleShare = useCallback(() => {
    // Implement share functionality
    console.log('Sharing session replay...');
  }, []);

  // DEBUG: Hook tracking
  const hookCallCount = useRef(0);
  const renderCount = useRef(0);
  
  renderCount.current++;
  hookCallCount.current = 0;
  
  const logHook = (hookName: string) => {
    hookCallCount.current++;
    console.log(`[DEBUG] Hook ${hookCallCount.current}: ${hookName} (render ${renderCount.current}) - sessionId: ${sessionId}`);
  };
  
  // Move hooks BEFORE early returns to prevent React hooks order violation
  logHook('useEffect - playbackTimer');
  // Playback timer - MOVED BEFORE EARLY RETURNS
  useEffect(() => {
    console.log(`[PLAYBACK] Timer effect triggered - isPlaying: ${isPlaying}, speed: ${speed}, duration: ${duration}, startTime: ${startTime}`);
    
    const actualDuration = duration > 0 ? duration : (events.length > 0 ? Math.max(...events.map(e => e.timestamp)) - startTime : 0);
    
    if (isPlaying && actualDuration > 0) {
      console.log(`[PLAYBACK] Starting timer - will advance by ${100 * speed}ms every 100ms, actualDuration: ${actualDuration}ms`);
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (100 * speed);
          const maxTime = actualDuration;
          
          console.log(`[PLAYBACK] Timer tick - prev: ${Math.floor(prev/1000)}s, next: ${Math.floor(next/1000)}s, max: ${Math.floor(maxTime/1000)}s`);
          
          if (next >= maxTime) {
            console.log(`[PLAYBACK] Reached end, stopping playback`);
            setIsPlaying(false);
            return maxTime;
          }
          return next;
        });
      }, 100);
    } else {
      if (playbackTimerRef.current) {
        console.log(`[PLAYBACK] Clearing timer`);
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, speed, duration, startTime, events]);

  logHook('useMemo - insights calculation');
  // Calculate insights and analytics - MOVED BEFORE EARLY RETURNS
  const insights = useMemo(() => {
    const totalEvents = events.length;
    const errorEvents = events.filter(e => e.type === 'error').length;
    const clickEvents = events.filter(e => e.type === 'click').length;
    const inputEvents = events.filter(e => e.type === 'input').length;
    
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
    const engagementScore = clickEvents + inputEvents * 2; // Weight inputs more heavily
    
    return {
      totalEvents,
      errorEvents,
      clickEvents,
      inputEvents,
      errorRate,
      engagementScore,
      avgTimeToError: errorEvents > 0 ? errors[0]?.timestamp - startTime : null,
      mostActiveElement: '#login-btn', // Mock data
      conversionFunnel: {
        landedOnPage: 100,
        clickedLogin: 85,
        filledForm: 70,
        submittedForm: 60,
        completedFlow: 45
      }
    };
  }, [events, errors, startTime]);

  logHook('useRef - hasTriggeredAutoPlay');
  const hasTriggeredAutoPlay = useRef(false);
  
  logHook('useEffect - auto-play trigger');
  // Auto-play functionality - start playing when session data loads
  useEffect(() => {
    // Auto-play when we have events and duration > 0, but only once
    if (!isLoading && !error && events.length > 0 && duration > 0 && !hasTriggeredAutoPlay.current) {
      console.log(`[AUTO-PLAY] Starting playback - ${events.length} events loaded, duration: ${duration}ms`);
      hasTriggeredAutoPlay.current = true;
      setIsPlaying(true);
    }
  }, [events.length, duration, isLoading, error]);

  // DEBUG: Log conditions before early returns
  console.log(`[DEBUG] Pre-return conditions (render ${renderCount.current}):`, {
    isLoading,
    error: !!error,
    eventsLength: events.length,
    hasSessionInfo: !!backendSessionData?.session_info,
    willReturnEarly: isLoading || error || (!isLoading && !error && events.length === 0 && !backendSessionData?.session_info)
  });

  // Handle loading and error states with modern design
  if (isLoading) {
    console.log(`[DEBUG] Returning loading state (render ${renderCount.current})`);
    return (
      <div className="space-y-6">
        {/* Loading Header Skeleton */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg animate-pulse">
                  <div className="w-5 h-5 bg-white bg-opacity-30 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="h-4 bg-gray-100 rounded w-32 animate-pulse"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right space-y-1">
                  <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                  <div className="h-3 bg-gray-100 rounded w-16 animate-pulse"></div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Loading Content Skeleton */}
        <Card className="h-96">
          <CardContent className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Loading Session Replay</h3>
                <p className="text-gray-600">Reconstructing user interactions and events...</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Controls Skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-8 animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    console.log(`[DEBUG] Returning error state (render ${renderCount.current}):`, error);
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="text-center p-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-red-900">Failed to Load Session</h3>
              <p className="text-red-700">
                Unable to retrieve session replay data. This could be due to a network issue or missing session data.
              </p>
              <p className="text-sm text-red-600">
                Session ID: {sessionId}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button 
                variant="outline" 
                className="border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => window.location.reload()}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button 
                variant="ghost" 
                className="text-red-600 hover:bg-red-100"
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state when no session data exists
  if (!isLoading && !error && events.length === 0 && !backendSessionData?.session_info) {
    console.log(`[DEBUG] Returning empty state (render ${renderCount.current})`);
    return (
      <Card className="border-gray-200">
        <CardContent className="text-center p-12">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Eye className="w-10 h-10 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">No Session Data Found</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                This session doesn&apos;t have any recorded events yet. Session replays will appear here when user interactions are captured.
              </p>
              <p className="text-sm text-gray-500">
                Session ID: <code className="bg-gray-100 px-2 py-1 rounded font-mono">{sessionId}</code>
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="ghost"
                onClick={() => window.history.back()}
              >
                Back to Sessions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  console.log(`[DEBUG] Proceeding to main render (render ${renderCount.current}) - Total hooks called: ${hookCallCount.current}`);

  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {/* Session Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Sparkles className="size-5 text-white" />
                </div>
                Session Analysis & Replay
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  Data-Driven
                </Badge>
                {pollingData.isLive && isPolling && (
                  <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse">
                    🔴 LIVE
                  </Badge>
                )}
                {pollingData.connectionStatus === 'connected' && !pollingData.isLive && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    Connected (Polling)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                Analyzing user interactions, page views, clicks, and performance metrics for session {sessionId.slice(0, 8)}...
                <br />
                <span className="text-sm">
                  User: {metadata.userId} • Started: {new Date(startTime).toLocaleString()} • {events.length} events captured
                </span>
                {isPlaying && (
                  <span className="ml-2 text-green-600 animate-pulse">
                    • ▶️ ANALYZING
                  </span>
                )}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Playback Progress Info */}
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Clock className="size-4" />
                <span>
                  {Math.floor(currentTime / 1000)}s / {Math.floor((duration > 0 ? duration : (events.length > 0 ? Math.max(...events.map(e => e.timestamp)) - startTime : 0)) / 1000)}s
                  {speed !== 1 && <span className="ml-1 text-blue-600">({speed}x)</span>}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{insights.engagementScore}</div>
                <div className="text-xs text-muted-foreground">Engagement Score</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">{insights.errorRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Error Rate</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{Math.floor(metadata.duration / 60000)}m</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Interface */}
      <div className={cn(
        "transition-all duration-300",
        isFullscreen && "fixed inset-0 z-50 bg-black p-2 sm:p-4 flex flex-col"
      )}>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <TabsList className={cn(
            "grid w-full mb-4 sm:mb-6 h-auto",
            isMobile ? "grid-cols-2 gap-1 p-1" : "grid-cols-4"
          )}>
            <TabsTrigger value="replay" className={cn(
              "flex items-center gap-1 sm:gap-2 h-10",
              isMobile && "px-2 py-2 text-xs flex-col gap-1"
            )}>
              <Eye className={cn("size-4", isMobile && "size-3")} />
              <span className={cn(isMobile && "text-xs leading-none")}>
                {isMobile ? "Analysis" : "Session Analysis"}
              </span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className={cn(
              "flex items-center gap-1 sm:gap-2 h-10",
              isMobile && "px-2 py-2 text-xs flex-col gap-1"
            )}>
              <TrendingUp className={cn("size-4", isMobile && "size-3")} />
              <span className={cn(isMobile && "text-xs leading-none")}>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className={cn(
              "flex items-center gap-1 sm:gap-2 h-10",
              isMobile && "px-2 py-2 text-xs flex-col gap-1"
            )}>
              <Clock className={cn("size-4", isMobile && "size-3")} />
              <span className={cn(isMobile && "text-xs leading-none")}>Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className={cn(
              "flex items-center gap-1 sm:gap-2 h-10 relative",
              isMobile && "px-2 py-2 text-xs flex-col gap-1"
            )}>
              <Target className={cn("size-4", isMobile && "size-3")} />
              <span className={cn(isMobile && "text-xs leading-none")}>
                {isMobile ? "Insights" : "AI Insights"}
              </span>
              {correlations.length > 0 && (
                <Badge variant="destructive" className={cn(
                  "ml-1 px-1.5 py-0.5 text-xs",
                  isMobile && "absolute -top-1 -right-1 px-1 py-0 text-xs min-w-4 h-4"
                )}>
                  {correlations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="replay" className="flex-1 flex flex-col space-y-4">
            {/* Main Session Analyzer */}
            <div className="flex-1">
              <MobileResponsiveEnhancements
                onViewportChange={(viewport) => console.log('Viewport changed:', viewport)}
                className="h-full"
              >
                <RealisticSessionAnalyzer
                  events={events}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  sessionId={sessionId}
                  className="h-full"
                />
              </MobileResponsiveEnhancements>
            </div>
            
            {/* Event List - Secondary View */}
            <Card className="max-h-64 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="size-4" />
                  Recent Events ({events.slice(0, 10).length} shown)
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <div className="space-y-1">
                  {events.length === 0 ? (
                    <div className="text-center text-gray-500 py-4 text-sm">
                      No events found for this session
                    </div>
                  ) : (
                    events.slice(0, 10).map((event, index) => {
                      const relativeTime = event.timestamp - startTime;
                      const isCurrentEvent = currentTime >= relativeTime - 500 && currentTime <= relativeTime + 500;
                      
                      return (
                        <div
                          key={`event-${sessionId}-${event.id}-${event.timestamp}-${index}`}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded text-xs transition-all cursor-pointer",
                            isCurrentEvent ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                          )}
                          onClick={() => {
                            const eventTime = relativeTime;
                            setCurrentTime(eventTime);
                            console.log(`[SEEK] Jumped to event at ${Math.floor(eventTime / 1000)}s`);
                          }}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0",
                            event.type === 'error' ? "bg-red-500" :
                            event.type === 'click' ? "bg-blue-500" :
                            event.type === 'input' ? "bg-green-500" :
                            event.type === 'network' ? "bg-purple-500" :
                            "bg-gray-500"
                          )}>
                            {event.type.charAt(0).toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <span className="font-medium capitalize">
                              {event.type.replace('_', ' ')}
                            </span>
                            <span className="text-gray-500 ml-2">
                              +{Math.floor(relativeTime / 1000)}s
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cinematic Controls */}
            <CinematicReplayControls
              currentTime={currentTime}
              duration={duration > 0 ? duration : (events.length > 0 ? Math.max(...events.map(e => e.timestamp)) - startTime : 0)}
              isPlaying={isPlaying}
              speed={speed}
              volume={volume}
              isMuted={isMuted}
              isFullscreen={isFullscreen}
              events={events}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSeek={handleSeek}
              onSpeedChange={handleSpeedChange}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onFullscreenToggle={handleFullscreenToggle}
              onSkipToEvent={handleSkipToEvent}
              onExport={handleExport}
              onShare={handleShare}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Total Events</p>
                      <p className="text-2xl font-bold">{insights.totalEvents}</p>
                    </div>
                    <Activity className="size-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Click Events</p>
                      <p className="text-2xl font-bold text-green-600">{insights.clickEvents}</p>
                    </div>
                    <Target className="size-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Form Inputs</p>
                      <p className="text-2xl font-bold text-blue-600">{insights.inputEvents}</p>
                    </div>
                    <Zap className="size-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Errors</p>
                      <p className="text-2xl font-bold text-red-600">{insights.errorEvents}</p>
                    </div>
                    <AlertTriangle className="size-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>User progression through key actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(insights.conversionFunnel).map(([step, percentage]) => (
                    <div key={step} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium capitalize">
                        {step.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000"
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>Chronological view of all user interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "space-y-3 overflow-y-auto",
                  isMobile ? "max-h-64 text-sm" : "max-h-96"
                )}>
                  {events.map((event, index) => {
                    const relativeTime = event.timestamp - startTime;
                    const isActive = Math.abs(currentTime - relativeTime) < 1000;
                    const hasCorrelation = correlations.some(c => c.errorId === event.id);
                    const isErrorEvent = event.type === 'error';
                    
                    return (
                      <div
                        key={`timeline-${sessionId}-${event.id}-${event.timestamp}-${index}`}
                        className={cn(
                          "flex items-center gap-2 sm:gap-4 rounded-lg cursor-pointer transition-all group",
                          isMobile ? "p-2 min-h-[44px]" : "p-3",
                          isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50",
                          isErrorEvent && "bg-red-50 border border-red-200",
                          hasCorrelation && "ring-2 ring-red-200 bg-red-25",
                          isTouchDevice && "touch-manipulation"
                        )}
                        onClick={() => {
                          handleSkipToEvent(event.id);
                          if (hasCorrelation) {
                            highlightError(event.id);
                          }
                        }}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs",
                          event.type === 'error' ? "bg-red-500" : 
                          event.type === 'click' ? "bg-blue-500" :
                          event.type === 'input' ? "bg-green-500" :
                          event.type === 'network' ? "bg-purple-500" :
                          event.type === 'navigation' ? "bg-orange-500" :
                          event.type === 'focus' || event.type === 'blur' ? "bg-yellow-500" :
                          event.type === 'scroll' ? "bg-indigo-500" : "bg-gray-500"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium capitalize">{event.type.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-600">
                            {event.type === 'error' && (event.data as Record<string, unknown>)?.message ? String((event.data as Record<string, unknown>).message) :
                             event.type === 'click' && ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent ? `Clicked: "${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}"` :
                             event.type === 'input' && (event.data as Record<string, unknown>)?.value ? `Input: "${String((event.data as Record<string, unknown>).value)}"` :
                             event.type === 'network' ? `${String((event.data as Record<string, unknown>)?.method) || 'GET'} ${String((event.data as Record<string, unknown>)?.url)}` :
                             event.type === 'navigation' && (event.data as Record<string, unknown>)?.url ? `Loaded: ${String((event.data as Record<string, unknown>).url)}` :
                             event.type === 'focus' && ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent ? `Focused: "${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}"` :
                             event.type === 'blur' && ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent ? `Blurred: "${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}"` :
                             (event.data as Record<string, unknown>)?.url ? String((event.data as Record<string, unknown>).url) :
                             'User interaction'}
                          </div>
                          {Boolean(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName) && (
                            <div className="text-xs text-gray-500 font-mono">
                              {Boolean(((event.data as Record<string, unknown>).target as Record<string, unknown>).tagName) && String(((event.data as Record<string, unknown>).target as Record<string, unknown>).tagName).toLowerCase()}
                              {Boolean(((event.data as Record<string, unknown>).target as Record<string, unknown>).className) && `.${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).className).split(' ')[0]}`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-500">
                            {Math.floor(relativeTime / 1000)}s
                          </div>
                          {hasCorrelation && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="size-4 text-red-500" />
                              <span className="text-xs text-red-600 font-medium">
                                Correlated
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-purple-600" />
                  AI-Powered Insights
                </CardTitle>
                <CardDescription>
                  Intelligent analysis of user behavior and potential issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Error Correlations Section */}
                {correlations.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="size-5 text-red-500" />
                      Error Analysis & Correlations ({correlations.length})
                    </h3>
                    <div className="space-y-3">
                      {correlations.map((correlation) => (
                        <Card key={correlation.errorId} className="border-l-4 border-l-red-500">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={correlation.errorSeverity === 'critical' ? 'destructive' : 'secondary'}>
                                    {correlation.errorSeverity.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {Math.floor((correlation.error.timestamp - startTime) / 1000)}s into session
                                  </span>
                                </div>
                                <div className="font-medium text-gray-900 mb-1">
                                  {correlation.error.message}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>Root Cause:</strong> {correlation.rootCause}
                                </div>
                                {correlation.userPath.length > 0 && (
                                  <div className="text-sm text-gray-600 mb-2">
                                    <strong>User Path:</strong> {correlation.userPath.join(' → ')}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => highlightError(correlation.errorId)}
                                className={cn(
                                  "ml-4",
                                  activeErrorId === correlation.errorId && "bg-red-100 border-red-300"
                                )}
                              >
                                {activeErrorId === correlation.errorId ? 'Clear' : 'Highlight'}
                              </Button>
                            </div>
                            {correlation.suggestions.length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">Suggestions:</div>
                                <div className="space-y-1">
                                  {correlation.suggestions.slice(0, 3).map((suggestion, index) => (
                                    <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                      <span className="text-green-500 mt-1">•</span>
                                      <span>{suggestion}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">🎯 User Intent Analysis</h3>
                    <p className="text-sm text-blue-800">
                      User attempted to log in but encountered a network error. High probability of task abandonment.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <h3 className="font-semibold text-orange-900 mb-2">⚠️ Critical Issues</h3>
                    <p className="text-sm text-orange-800">
                      Login form failed with network timeout. Recommend implementing retry mechanism.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <h3 className="font-semibold text-green-900 mb-2">✅ Positive Signals</h3>
                    <p className="text-sm text-green-800">
                      User engaged with multiple form fields, indicating strong intent to complete the task.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <h3 className="font-semibold text-purple-900 mb-2">🔮 Recommendations</h3>
                    <p className="text-sm text-purple-800">
                      Add loading states and error retry buttons to improve user experience.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}