'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw,
  MousePointer,
  Activity,
  ChevronDown,
  ChevronRight,
  Network,
  Terminal,
  Bug,
  BarChart3,
  Users,
  Search,
  Filter,
  Share,
  Download,
  Gauge,
  AlertCircle,
  XCircle,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionEvents } from '@/lib/hooks/useReviData';

interface SimpleSessionReplayProps {
  sessionId: string;
}

export function SimpleSessionReplay({ sessionId }: SimpleSessionReplayProps) {
  const { data: backendData, isLoading, error } = useSessionEvents(sessionId);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('console');
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilters, setEventFilters] = useState({
    errors: true,
    network: true,
    userActions: true,
    pageLoad: true,
    performance: true
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Helper functions - moved above useMemo hooks to fix hoisting issue
  const parseEventDetails = (event: { id: string; event_type?: string; type?: string; timestamp: string; source?: string; data?: unknown }) => {
    const baseEvent = {
      id: event.id,
      type: event.event_type || event.type,
      timestamp: new Date(event.timestamp).getTime(),
      source: event.source || 'unknown'
    };

    switch (event.event_type || event.type) {
      case 'page_load':
        return {
          ...baseEvent,
          category: 'performance',
          severity: ((event.data as Record<string, unknown>)?.loadTime as number || 0) > 1000 ? 'warning' : 'info',
          title: 'Page Load',
          details: {
            url: String((event.data as Record<string, unknown>)?.url || ''),
            title: String((event.data as Record<string, unknown>)?.title || ''),
            loadTime: (event.data as Record<string, unknown>)?.loadTime as number || 0,
            referrer: String((event.data as Record<string, unknown>)?.referrer || ''),
            isSlowLoad: ((event.data as Record<string, unknown>)?.loadTime as number || 0) > 1000,
            performanceGrade: ((event.data as Record<string, unknown>)?.loadTime as number || 0) < 800 ? 'A' : 
                             ((event.data as Record<string, unknown>)?.loadTime as number || 0) < 1200 ? 'B' : 'C'
          },
          description: `${String((event.data as Record<string, unknown>)?.title || 'Page')} loaded in ${(event.data as Record<string, unknown>)?.loadTime as number || 0}ms`,
          richDescription: ((event.data as Record<string, unknown>)?.loadTime as number || 0) > 1000 
            ? `🟡 SLOW LOAD: ${Math.round(((event.data as Record<string, unknown>).loadTime as number || 0) - 800)}ms slower than target`
            : `🟢 FAST LOAD: Page loaded efficiently`
        };

      case 'focus':
      case 'blur':
        return {
          ...baseEvent,
          category: 'interaction',
          severity: 'info',
          title: event.type === 'focus' ? 'Element Focused' : 'Element Unfocused',
          details: {
            tagName: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName || ''),
            textContent: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent || ''),
            className: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.className || ''),
            id: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.id || ''),
            hasAccessibility: !!(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.['aria-label'] || ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.role),
            elementSelector: `${String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName || 'unknown')}${((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.id ? `#${((event.data as Record<string, unknown>).target as Record<string, unknown>).id}` : ''}`
          },
          description: `${event.type === 'focus' ? 'Focused' : 'Unfocused'}: ${String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent || ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName || 'Element')}`,
          richDescription: `🎯 ${((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent ? `"${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}"` : String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName) || 'Element'} - ${((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.className ? 'Styled' : 'Unstyled'}`
        };

      case 'click':
        return {
          ...baseEvent,
          category: 'interaction',
          severity: 'info',
          title: 'Click Event',
          details: {
            coordinates: (event.data as Record<string, unknown>)?.coordinates || event.data,
            target: (event.data as Record<string, unknown>)?.target || {},
            elementText: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent || ''),
            elementType: String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName || ''),
            hasValidTarget: !!(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent || ((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName)
          },
          description: `Clicked: ${String(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent || 'Element')}`,
          richDescription: `🖱️ CLICK: ${((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent ? `"${String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}"` : 'Unknown element'} at (${((event.data as Record<string, unknown>)?.coordinates as Record<string, unknown>)?.x || (event.data as Record<string, unknown>)?.x || 0}, ${((event.data as Record<string, unknown>)?.coordinates as Record<string, unknown>)?.y || (event.data as Record<string, unknown>)?.y || 0})`
        };

      case 'error':
        const errorData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const metadata = errorData?.metadata || errorData;
        const errorInfo = metadata?.error || errorData?.error || {};
        const userContext = metadata?.user_context || errorData?.user_context || {};
        const customContext = metadata?.custom_context || errorData?.custom_context || {};
        
        return {
          ...baseEvent,
          category: 'error',
          severity: customContext?.level === 'fatal' ? 'critical' : 'error',
          title: `${customContext?.tags?.errorType || 'Error'}`,
          details: {
            message: errorInfo.message || errorData.message || 'Unknown error',
            stack: errorInfo.stack || errorData.stack || '',
            errorType: customContext?.tags?.errorType || 'UnknownError',
            level: customContext?.level || 'error',
            sessionDuration: userContext?.session_duration || 0,
            pageInteractions: userContext?.page_interactions || 0,
            timeOnPage: userContext?.time_on_page || 0,
            userId: customContext?.extra?.userId || '',
            userAgent: customContext?.extra?.userAgent || '',
            batchIndex: customContext?.extra?.batchIndex || 0,
            errorIndex: customContext?.extra?.errorIndex || 0,
            tags: customContext?.tags || {},
            isCritical: customContext?.level === 'fatal',
            hasLowEngagement: (userContext?.session_duration || 0) > 300000 && (userContext?.page_interactions || 0) < 3
          },
          description: errorInfo.message || errorData.message || 'Unknown error occurred',
          richDescription: `🚨 ${customContext?.tags?.errorType || 'ERROR'}: ${(errorInfo.message || errorData.message || '').substring(0, 60)}${(errorInfo.message || errorData.message || '').length > 60 ? '...' : ''}`
        };

      case 'network':
        return {
          ...baseEvent,
          category: 'network',
          severity: ((event.data as Record<string, unknown>)?.status as number >= 400) ? 'error' : 'info',
          title: 'Network Request',
          details: {
            method: String((event.data as Record<string, unknown>)?.method || 'GET'),
            url: String((event.data as Record<string, unknown>)?.url || ''),
            status: (event.data as Record<string, unknown>)?.status as number || 0,
            responseTime: (event.data as Record<string, unknown>)?.responseTime as number || 0,
            isFailure: ((event.data as Record<string, unknown>)?.status as number >= 400),
            isSlowRequest: ((event.data as Record<string, unknown>)?.responseTime as number || 0) > 1000
          },
          description: `${String((event.data as Record<string, unknown>)?.method || 'GET')} ${String((event.data as Record<string, unknown>)?.url || '')}`,
          richDescription: `📡 ${String((event.data as Record<string, unknown>)?.method || 'GET')} ${String((event.data as Record<string, unknown>)?.url).substring(0, 40) || ''} - ${((event.data as Record<string, unknown>)?.status as number >= 400) ? '🔴 FAILED' : '🟢 SUCCESS'} (${(event.data as Record<string, unknown>)?.status as number || 0})`
        };

      default:
        return {
          ...baseEvent,
          category: 'other',
          severity: 'info',
          title: event.event_type || event.type || 'Event',
          details: event.data || {},
          description: `${event.event_type || event.type}: ${JSON.stringify(event.data || {}).substring(0, 50)}`,
          richDescription: `📋 ${event.event_type || event.type}`
        };
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const startTime = events.length > 0 ? events[0].timestamp : Date.now();
    const seconds = Math.floor((timestamp - startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  // Process and sort events by timestamp with rich parsing
  const events = useMemo(() => {
    if (!backendData?.events) return [];
    
    return backendData.events
      .map((event, index) => {
        const parsedEvent = parseEventDetails({
          ...event,
          id: String(event.id),
          timestamp: event.timestamp.toISOString()
        });
        return {
          ...parsedEvent,
          originalIndex: index,
          originalData: event
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [backendData?.events]);

  // Filter events based on search and filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
          event.title.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower) ||
          event.richDescription.toLowerCase().includes(searchLower) ||
          JSON.stringify(event.details).toLowerCase().includes(searchLower)
        );
        if (!matchesSearch) return false;
      }

      // Category filters
      switch (event.category) {
        case 'error':
          return eventFilters.errors;
        case 'network':
          return eventFilters.network;
        case 'interaction':
          return eventFilters.userActions;
        case 'performance':
          return eventFilters.pageLoad || eventFilters.performance;
        default:
          return true;
      }
    });
  }, [events, searchTerm, eventFilters]);

  const sessionStartTime = events.length > 0 ? events[0].timestamp : Date.now();

  // AI-Powered Session Analysis (like LogRocket Galileo)
  const sessionAnalysis = useMemo(() => {
    const totalDuration = events.length > 0 ? 
      (events[events.length - 1].timestamp - events[0].timestamp) / 1000 : 0;
    
    const errorEvents = events.filter(e => e.category === 'error');
    const interactionEvents = events.filter(e => e.category === 'interaction');
    const networkEvents = events.filter(e => e.category === 'network');
    const performanceEvents = events.filter(e => e.category === 'performance');
    
    // Critical issues analysis
    const criticalErrors = errorEvents.filter(e => e.severity === 'critical');
    const authErrors = errorEvents.filter(e => (e.details as Record<string, unknown>)?.errorType && String((e.details as Record<string, unknown>)?.errorType).includes('Authentication'));
    const slowLoads = performanceEvents.filter(e => (e.details as Record<string, unknown>)?.isSlowLoad);
    const failedRequests = networkEvents.filter(e => (e.details as Record<string, unknown>)?.isFailure);
    
    // User journey analysis
    const hasLongSessionLowInteraction = totalDuration > 300 && interactionEvents.length < 3;
    const hasRepeatedFocusBlur = events.filter((event, index) => {
      const next = events[index + 1];
      return event.category === 'interaction' && 
             next?.category === 'interaction' && 
             Math.abs(event.timestamp - next.timestamp) < 1000;
    }).length > 3;

    // Engagement scoring (0-100)
    let healthScore = 100;
    if (criticalErrors.length > 0) healthScore -= 30;
    if (authErrors.length > 0) healthScore -= 25;
    if (hasLongSessionLowInteraction) healthScore -= 20;
    if (slowLoads.length > 0) healthScore -= 15;
    if (failedRequests.length > 0) healthScore -= 10;
    if (hasRepeatedFocusBlur) healthScore -= 10;

    // AI Insights generation
    const insights = [];
    const recommendations = [];
    const criticalIssues = [];

    if (criticalErrors.length > 0) {
      criticalIssues.push(`${criticalErrors.length} critical error(s) blocking user flow`);
      recommendations.push('Investigate fatal errors immediately - users cannot complete actions');
    }

    if (authErrors.length > 0) {
      criticalIssues.push(`Authentication system failing (${authErrors.length} auth errors)`);
      recommendations.push('Check token validation and session management');
    }

    if (hasLongSessionLowInteraction) {
      const minutes = Math.round(totalDuration / 60);
      insights.push(`${minutes}-minute session with only ${interactionEvents.length} interactions`);
      recommendations.push('User may be blocked by errors or poor UX - investigate conversion funnel');
    }

    if (slowLoads.length > 0) {
      const avgSlowTime = slowLoads.reduce((sum, e) => sum + ((e.details as Record<string, unknown>)?.loadTime as number || 0), 0) / slowLoads.length;
      insights.push(`Page loads averaging ${Math.round(avgSlowTime)}ms (${Math.round(avgSlowTime - 800)}ms over target)`);
      recommendations.push('Optimize bundle size and server response times');
    }

    if (hasRepeatedFocusBlur) {
      insights.push('User struggling with UI elements (repeated focus/blur cycles)');
      recommendations.push('Review form accessibility and element focus states');
    }

    // Success metrics
    const successfulInteractions = interactionEvents.filter(e => 
      !errorEvents.some(err => Math.abs(err.timestamp - e.timestamp) < 5000)
    );

    return {
      healthScore: Math.max(0, healthScore),
      status: healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'warning' : 'critical',
      totalDuration: Math.round(totalDuration),
      totalEvents: events.length,
      
      // Counts by category
      errorCount: errorEvents.length,
      criticalErrorCount: criticalErrors.length,
      interactionCount: interactionEvents.length,
      networkRequestCount: networkEvents.length,
      performanceEventCount: performanceEvents.length,
      
      // Performance metrics
      avgPageLoadTime: performanceEvents.length > 0 ? 
        Math.round(performanceEvents.reduce((sum, e) => sum + ((e.details as Record<string, unknown>)?.loadTime as number || 0), 0) / performanceEvents.length) : 0,
      slowLoadCount: slowLoads.length,
      failedRequestCount: failedRequests.length,
      
      // Engagement metrics
      engagementRate: totalDuration > 0 ? (interactionEvents.length / (totalDuration / 60)).toFixed(2) : '0',
      successfulInteractionRate: interactionEvents.length > 0 ? 
        Math.round((successfulInteractions.length / interactionEvents.length) * 100) : 0,
      
      // AI Insights
      criticalIssues,
      insights,
      recommendations,
      
      // Flags
      hasAuthenticationIssues: authErrors.length > 0,
      hasPerformanceIssues: slowLoads.length > 0 || failedRequests.length > 0,
      hasUserExperienceIssues: hasLongSessionLowInteraction || hasRepeatedFocusBlur,
      hasCriticalErrors: criticalErrors.length > 0
    };
  }, [events]);

  // Auto-play functionality with fixed intervals
  useEffect(() => {
    if (!isPlaying || currentEventIndex >= filteredEvents.length - 1) return;

    // Use fixed intervals instead of real-time delays
    const baseInterval = 800; // 800ms base interval
    const playbackDelay = baseInterval / playbackSpeed;

    const timer = setTimeout(() => {
      setCurrentEventIndex(prev => prev + 1);
    }, playbackDelay);

    return () => clearTimeout(timer);
  }, [isPlaying, currentEventIndex, filteredEvents, playbackSpeed]);

  const handlePlay = () => {
    if (currentEventIndex >= filteredEvents.length - 1) {
      setCurrentEventIndex(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-700 dark:text-gray-300 font-light">Loading session replay...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !backendData) {
    return (
      <div className="p-6">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="text-center p-8">
            <div className="text-red-600 dark:text-red-400 mb-4 text-lg font-normal">Failed to load session data</div>
            <p className="text-gray-600 dark:text-gray-400 font-light">Please check your connection and try again</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-6">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="text-center p-8">
            <div className="text-gray-600 dark:text-gray-400 mb-4 text-lg font-normal">No events found</div>
            <p className="text-gray-500 dark:text-gray-400 font-light">No session events were recorded for this session</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = filteredEvents.length > 0 ? (currentEventIndex / (filteredEvents.length - 1)) * 100 : 0;
  const currentEvent = filteredEvents[currentEventIndex];


  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* AI Analysis Header - Like LogRocket Galileo */}
      <div className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-normal text-gray-800 dark:text-gray-200">Session Replay</h1>
            <div className="flex items-center gap-2">
              <Gauge className={cn("size-5", getHealthScoreColor(sessionAnalysis.healthScore))} />
              <span className={cn("text-lg font-bold", getHealthScoreColor(sessionAnalysis.healthScore))}>
                {sessionAnalysis.healthScore}/100
              </span>
              <Badge variant={sessionAnalysis.status === 'critical' ? 'destructive' : 'secondary'}>
                {sessionAnalysis.status.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 font-normal">
              <Share className="size-4 mr-2" />
              Share
            </Button>
            <Button size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 font-normal">
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-6 gap-4 text-center">
          <div className="bg-gray-100/30 dark:bg-gray-700/30 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="text-2xl font-normal text-gray-900 dark:text-gray-200">{Math.round(sessionAnalysis.totalDuration / 60)}m</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Duration</div>
          </div>
          <div className="bg-blue-50/30 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <div className="text-2xl font-normal text-blue-600 dark:text-blue-400">{sessionAnalysis.interactionCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Interactions</div>
          </div>
          <div className="bg-red-50/30 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-700 rounded-lg p-3">
            <div className="text-2xl font-normal text-red-600 dark:text-red-400">{sessionAnalysis.errorCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Errors</div>
          </div>
          <div className="bg-yellow-50/30 dark:bg-yellow-900/20 backdrop-blur-sm border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <div className="text-2xl font-normal text-yellow-600 dark:text-yellow-400">{sessionAnalysis.avgPageLoadTime}ms</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Avg Load</div>
          </div>
          <div className="bg-green-50/30 dark:bg-green-900/20 backdrop-blur-sm border border-green-200 dark:border-green-700 rounded-lg p-3">
            <div className="text-2xl font-normal text-green-600 dark:text-green-400">{sessionAnalysis.successfulInteractionRate}%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Success Rate</div>
          </div>
          <div className="bg-purple-50/30 dark:bg-purple-900/20 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-lg p-3">
            <div className="text-2xl font-normal text-purple-600 dark:text-purple-400">{sessionAnalysis.engagementRate}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Engage/Min</div>
          </div>
        </div>

        {/* AI Insights Alert */}
        {sessionAnalysis.criticalIssues.length > 0 && (
          <div className="mt-4 p-3 bg-red-50/30 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-normal text-red-800 dark:text-red-400">🤖 AI Analysis - Critical Issues Detected</h3>
                <ul className="mt-1 space-y-1">
                  {sessionAnalysis.criticalIssues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-700 dark:text-red-400 font-light">• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main DevTools-Inspired Layout */}
      <div className="flex-1 flex">
        {/* Left Panel - Replay Area */}
        <div className="w-2/5 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-normal text-gray-900 dark:text-gray-200 mb-3">Session Timeline</h2>
            
            {/* Controls */}
            <div className="flex items-center gap-2 mb-4">
              {!isPlaying ? (
                <Button onClick={handlePlay} size="sm" className="bg-blue-600/90 hover:bg-blue-700 backdrop-blur-sm text-white font-normal">
                  <Play className="size-4 mr-1" />
                  Play
                </Button>
              ) : (
                <Button onClick={handlePause} size="sm" className="bg-gray-600/90 hover:bg-gray-700 backdrop-blur-sm text-white font-normal">
                  <Pause className="size-4 mr-1" />
                  Pause
                </Button>
              )}
              <Button onClick={handleStop} size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 font-normal">
                <Square className="size-3" />
              </Button>
              <Button onClick={handleReset} size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 font-normal">
                <RotateCcw className="size-3" />
              </Button>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-normal">Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-200 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm font-light"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                </select>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 font-light">
                <span>Event {currentEventIndex + 1} of {filteredEvents.length}</span>
                <span>{currentEvent ? formatTimestamp(currentEvent.timestamp) : '0:00'}</span>
              </div>
              <div className="w-full bg-gray-200/30 dark:bg-gray-700/30 backdrop-blur-sm rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Current Event Detail */}
          {currentEvent && (
            <div className="p-4">
              <div className={cn("border rounded-lg p-4", getSeverityColor(currentEvent.severity))}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {currentEvent.category === 'error' && <Bug className="size-5 text-red-600" />}
                    {currentEvent.category === 'network' && <Network className="size-5 text-blue-600" />}
                    {currentEvent.category === 'interaction' && <MousePointer className="size-5 text-green-600" />}
                    {currentEvent.category === 'performance' && <Timer className="size-5 text-yellow-600" />}
                    {currentEvent.category === 'other' && <Activity className="size-5 text-gray-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{currentEvent.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {currentEvent.category}
                      </Badge>
                      {currentEvent.severity === 'critical' && (
                        <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
                      )}
                    </div>
                    <p className="text-sm mb-2">{currentEvent.richDescription}</p>
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(currentEvent.timestamp)} • Source: {currentEvent.source}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - DevTools Tabs */}
        <div className="flex-1 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <TabsList className="grid grid-cols-5 w-full h-12 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
                <TabsTrigger value="console" className="flex items-center gap-2">
                  <Terminal className="size-4" />
                  Console
                  <Badge variant="secondary" className="text-xs">{events.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="network" className="flex items-center gap-2">
                  <Network className="size-4" />
                  Network
                  <Badge variant="secondary" className="text-xs">{sessionAnalysis.networkRequestCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="errors" className="flex items-center gap-2">
                  <Bug className="size-4" />
                  Errors
                  <Badge variant="destructive" className="text-xs">{sessionAnalysis.errorCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="actions" className="flex items-center gap-2">
                  <Users className="size-4" />
                  User Actions
                  <Badge variant="secondary" className="text-xs">{sessionAnalysis.interactionCount}</Badge>
                </TabsTrigger>
              </TabsList>
              </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search and Filter Bar */}
              <div className="p-3 bg-white/20 dark:bg-gray-700/20 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search events, errors, URLs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-gray-200 font-light focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <Button size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-200 font-normal">
                    <Filter className="size-4 mr-1" />
                    Filters
                  </Button>
                </div>
              </div>

              <TabsContent value="console" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-96 overflow-y-auto p-3 space-y-2">
                  {filteredEvents.map((event, index) => (
                    <div
                      key={`console-${event.id}-${index}`}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                        "bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700",
                        "hover:bg-white/50 dark:hover:bg-gray-700/50",
                        event.id === selectedEventId && "bg-blue-100/50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600",
                        event.category === 'error' && "bg-red-100/30 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                      )}
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setCurrentEventIndex(events.findIndex(e => e.id === event.id));
                      }}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {event.category === 'error' && <XCircle className="size-4 text-red-600" />}
                        {event.category === 'network' && <Network className="size-4 text-blue-600" />}
                        {event.category === 'interaction' && <MousePointer className="size-4 text-green-600" />}
                        {event.category === 'performance' && <Timer className="size-4 text-yellow-600" />}
                        {event.category === 'other' && <Activity className="size-4 text-gray-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                            {formatTimestamp(event.timestamp)}
                          </span>
                          <Badge variant="outline" className="text-xs bg-gray-100/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                            {event.category}
                          </Badge>
                          {event.severity === 'critical' && (
                            <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600">CRITICAL</Badge>
                          )}
                        </div>
                        <p className="text-sm font-normal text-gray-900 dark:text-gray-200 mb-1">{event.title}</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-light">{event.richDescription}</p>
                        
                        {/* Rich Error Details */}
                        {event.category === 'error' && event.details && (
                          <div className="mt-2 p-2 bg-red-100/30 dark:bg-red-900/20 backdrop-blur-sm rounded text-xs border border-red-200 dark:border-red-700">
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div>
                                <span className="text-red-700 dark:text-red-400 font-normal">Duration:</span>
                                <span className="ml-1 font-mono text-gray-900 dark:text-gray-200">{Math.round(((event.details as Record<string, unknown>)?.sessionDuration as number || 0) / 1000)}s</span>
                              </div>
                              <div>
                                <span className="text-red-700 dark:text-red-400 font-normal">Interactions:</span>
                                <span className="ml-1 font-mono text-gray-900 dark:text-gray-200">{(event.details as Record<string, unknown>)?.pageInteractions as number || 0}</span>
                              </div>
                              <div>
                                <span className="text-red-700 dark:text-red-400 font-normal">Level:</span>
                                <span className="ml-1 font-mono text-red-800 dark:text-red-400">{String((event.details as Record<string, unknown>)?.level || '')}</span>
                              </div>
                            </div>
                            {Boolean((event.details as Record<string, unknown>)?.hasLowEngagement) && (
                              <div className="text-red-700 dark:text-red-400 font-normal">
                                ⚠️ Low Engagement: Long session with few interactions
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Performance Details */}
                        {event.category === 'performance' && event.details && (
                          <div className="mt-2 p-2 bg-yellow-100/30 dark:bg-yellow-900/20 backdrop-blur-sm rounded text-xs border border-yellow-200 dark:border-yellow-700">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-yellow-700 dark:text-yellow-400 font-normal">Load Time:</span>
                                <span className="ml-1 font-mono text-gray-900 dark:text-gray-200">{(event.details as Record<string, unknown>)?.loadTime as number || 0}ms</span>
                              </div>
                              <div>
                                <span className="text-yellow-700 dark:text-yellow-400 font-normal">Grade:</span>
                                <span className="ml-1 font-mono text-gray-900 dark:text-gray-200">{String((event.details as Record<string, unknown>)?.performanceGrade || '')}</span>
                              </div>
                            </div>
                            {Boolean((event.details as Record<string, unknown>)?.isSlowLoad) && (
                              <div className="text-yellow-700 dark:text-yellow-400 font-normal mt-1">
                                🐌 SLOW: {Math.round(((event.details as Record<string, unknown>)?.loadTime as number || 0) - 800)}ms over target
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="network" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-96 overflow-y-auto p-3 space-y-2">
                  {filteredEvents.filter(e => e.category === 'network').map((event, index) => (
                    <div key={`network-${event.id}-${index}`} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Network className="size-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-normal text-gray-900 dark:text-gray-200">{String((event.details as Record<string, unknown>)?.method || 'GET')}</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-light">{String((event.details as Record<string, unknown>)?.url || '')}</span>
                        </div>
                        <Badge variant={(event.details as Record<string, unknown>)?.isFailure ? "destructive" : "secondary"} className={(event.details as Record<string, unknown>)?.isFailure ? "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600" : "bg-gray-100/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"}>
                          {(event.details as Record<string, unknown>)?.status as number || 0}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-light">
                        {formatTimestamp(event.timestamp)} • Response: {(event.details as Record<string, unknown>)?.responseTime as number || 0}ms
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="errors" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-96 overflow-y-auto p-3 space-y-2">
                  {filteredEvents.filter(e => e.category === 'error').map((event, index) => (
                    <div key={`error-${event.id}-${index}`} className="bg-red-100/30 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-700 rounded-lg p-3 hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-all">
                      <div className="flex items-start gap-3">
                        <XCircle className="size-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-normal text-red-800 dark:text-red-400">{String((event.details as Record<string, unknown>)?.errorType || '')}</h3>
                            <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600">{String((event.details as Record<string, unknown>)?.level || '')}</Badge>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-400 font-light mb-3">{String((event.details as Record<string, unknown>)?.message || '')}</p>
                          
                          <div className="grid grid-cols-4 gap-3 text-xs bg-red-100/40 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-700 rounded p-2 mb-3">
                            <div>
                              <span className="text-red-700 dark:text-red-400 font-normal">Session:</span>
                              <div className="font-mono text-gray-900 dark:text-gray-200">{Math.round(((event.details as Record<string, unknown>)?.sessionDuration as number || 0) / 1000)}s</div>
                            </div>
                            <div>
                              <span className="text-red-700 dark:text-red-400 font-normal">Interactions:</span>
                              <div className="font-mono text-gray-900 dark:text-gray-200">{(event.details as Record<string, unknown>)?.pageInteractions as number || 0}</div>
                            </div>
                            <div>
                              <span className="text-red-700 dark:text-red-400 font-normal">Batch:</span>
                              <div className="font-mono text-gray-900 dark:text-gray-200">#{(event.details as Record<string, unknown>)?.batchIndex as number || 0}</div>
                            </div>
                            <div>
                              <span className="text-red-700 dark:text-red-400 font-normal">Error #:</span>
                              <div className="font-mono text-gray-900 dark:text-gray-200">{(event.details as Record<string, unknown>)?.errorIndex as number || 0}</div>
                            </div>
                          </div>

                          <button
                            onClick={() => setExpandedEvent(
                              expandedEvent === event.id ? null : event.id
                            )}
                            className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-normal"
                          >
                            {expandedEvent === event.id ? (
                              <>
                                <ChevronDown className="size-3" />
                                Hide Stack Trace
                              </>
                            ) : (
                              <>
                                <ChevronRight className="size-3" />
                                Show Stack Trace
                              </>
                            )}
                          </button>
                          
                          {expandedEvent === event.id && Boolean((event.details as Record<string, unknown>)?.stack) && (
                            <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto max-h-40">
                              {String((event.details as Record<string, unknown>).stack)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-96 overflow-y-auto p-3 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-normal text-yellow-600 dark:text-yellow-400">{sessionAnalysis.avgPageLoadTime}ms</div>
                        <div className="text-sm text-gray-700 dark:text-gray-400 font-light">Avg Load Time</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-normal text-red-600 dark:text-red-400">{sessionAnalysis.slowLoadCount}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-400 font-light">Slow Loads</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-normal text-blue-600 dark:text-blue-400">{sessionAnalysis.performanceEventCount}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-400 font-light">Page Loads</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-2">
                    {filteredEvents.filter(e => e.category === 'performance').map((event, index) => (
                      <div key={`perf-${event.id}-${index}`} className={cn(
                        "rounded-lg p-3 backdrop-blur-sm transition-all hover:bg-white/50 dark:hover:bg-gray-700/50",
                        (event.details as Record<string, unknown>)?.isSlowLoad 
                          ? "border border-yellow-300 dark:border-yellow-700 bg-yellow-100/30 dark:bg-yellow-900/20" 
                          : "border border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Timer className="size-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="font-normal text-gray-900 dark:text-gray-200">{String((event.details as Record<string, unknown>)?.title || '')}</span>
                            <Badge variant={(event.details as Record<string, unknown>)?.isSlowLoad ? "destructive" : "secondary"} className={(event.details as Record<string, unknown>)?.isSlowLoad ? "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600" : "bg-gray-100/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"}>
                              Grade {String((event.details as Record<string, unknown>)?.performanceGrade || '')}
                            </Badge>
                          </div>
                          <span className="text-sm font-mono text-gray-900 dark:text-gray-200">{(event.details as Record<string, unknown>)?.loadTime as number || 0}ms</span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 font-light">{String((event.details as Record<string, unknown>)?.url || '')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-96 overflow-y-auto p-3 space-y-2">
                  {filteredEvents.filter(e => e.category === 'interaction').map((event, index) => (
                    <div key={`action-${event.id}-${index}`} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all">
                      <div className="flex items-start gap-3">
                        <MousePointer className="size-4 text-green-600 dark:text-green-400 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-normal text-gray-900 dark:text-gray-200">{event.title}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-light">{formatTimestamp(event.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-300 font-light mb-2">{event.richDescription}</p>
                          {Boolean((event.details as Record<string, unknown>)?.elementText) && (
                            <div className="text-xs bg-gray-100/30 dark:bg-gray-700/30 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded p-2">
                              <span className="text-gray-700 dark:text-gray-400 font-normal">Target:</span>
                              <span className="ml-2 font-mono text-gray-900 dark:text-gray-200">&lt;{String((event.details as Record<string, unknown>)?.elementType || '').toLowerCase()}&gt;{String((event.details as Record<string, unknown>)?.elementText || '')}&lt;/{String((event.details as Record<string, unknown>)?.elementType || '').toLowerCase()}&gt;</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}