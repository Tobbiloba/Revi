'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MousePointer, 
  Clock, 
  Activity,
  Eye,
  BarChart3,
  Map,
  TrendingUp,
  Timer,
  Globe,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionEvent {
  id: string;
  type: string;
  timestamp: number;
  data: unknown;
}

interface RealisticSessionAnalyzerProps {
  events: SessionEvent[];
  currentTime: number;
  isPlaying: boolean;
  sessionId: string;
  className?: string;
}

interface ClickHeatmapPoint {
  x: number;
  y: number;
  timestamp: number;
  target: string;
}

interface PageView {
  url: string;
  timestamp: number;
  loadTime?: number;
  title?: string;
}

export function RealisticSessionAnalyzer({
  events,
  currentTime,
  isPlaying,
  sessionId,
  className
}: RealisticSessionAnalyzerProps) {
  console.log(sessionId)
  const [activeView, setActiveView] = useState('timeline');

  // Process events for analysis
  const analysis = useMemo(() => {
    const currentEvents = events.filter(event => event.timestamp <= currentTime);
    
    // Extract page views
    const pageViews: PageView[] = currentEvents
      .filter(e => e.type === 'page_load')
      .map(e => ({
        url: (e.data as Record<string, unknown>)?.url as string || '',
        timestamp: e.timestamp,
        loadTime: (e.data as Record<string, unknown>)?.loadTime as number || 0,
        title: (e.data as Record<string, unknown>)?.title as string || ''
      }));

    // Extract clicks with coordinates
    const clickPoints: ClickHeatmapPoint[] = currentEvents
      .filter(e => e.type === 'click' && (e.data as Record<string, unknown>)?.coordinates)
      .map(e => ({
        x: ((e.data as Record<string, unknown>).coordinates as Record<string, unknown>).x as number,
        y: ((e.data as Record<string, unknown>).coordinates as Record<string, unknown>).y as number,
        timestamp: e.timestamp,
        target: ((e.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent as string || ((e.data as Record<string, unknown>)?.target as Record<string, unknown>)?.tagName as string || 'Unknown'
      }));

    // Event timeline
    const timeline = currentEvents.map(event => ({
      ...event,
      relativeTime: event.timestamp - (events[0]?.timestamp || 0)
    })).sort((a, b) => a.timestamp - b.timestamp);

    // Event counts by type
    const eventCounts = currentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Performance metrics
    const totalDuration = currentEvents.length > 0 
      ? Math.max(...currentEvents.map(e => e.timestamp)) - Math.min(...currentEvents.map(e => e.timestamp))
      : 0;

    const averageLoadTime = pageViews.length > 0
      ? pageViews.reduce((sum, pv) => sum + (pv.loadTime || 0), 0) / pageViews.length
      : 0;

    return {
      pageViews,
      clickPoints,
      timeline,
      eventCounts,
      totalDuration,
      averageLoadTime,
      currentPageUrl: pageViews[pageViews.length - 1]?.url || 'Unknown'
    };
  }, [events, currentTime]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'click': return MousePointer;
      case 'page_load': return Globe;
      case 'focus': return Eye;
      case 'blur': return Eye;
      case 'input': return Zap;
      case 'visibility': return Activity;
      default: return Activity;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'click': return 'bg-blue-500';
      case 'page_load': return 'bg-green-500';
      case 'focus': return 'bg-yellow-500';
      case 'blur': return 'bg-gray-500';
      case 'input': return 'bg-purple-500';
      case 'visibility': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            Session Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {analysis.timeline.length} events
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatDuration(analysis.totalDuration)}
            </Badge>
            {isPlaying && (
              <Badge className="bg-green-500 animate-pulse">
                Playing
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline" className="flex items-center gap-1">
              <Clock className="size-3" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="flex items-center gap-1">
              <MousePointer className="size-3" />
              Clicks
            </TabsTrigger>
            <TabsTrigger value="journey" className="flex items-center gap-1">
              <Map className="size-3" />
              Journey
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {analysis.timeline.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No events found in this time range
                </div>
              ) : (
                analysis.timeline.map((event, index) => {
                  const Icon = getEventIcon(event.type);
                  const isActiveEvent = Math.abs(currentTime - event.timestamp) < 1000;
                  
                  return (
                    <div
                      key={`${event.id}-${index}`}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all",
                        isActiveEvent 
                          ? "bg-blue-50 border-blue-200 ring-2 ring-blue-200" 
                          : "bg-white hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5",
                        getEventColor(event.type)
                      )}>
                        <Icon className="size-3" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium capitalize">
                            {event.type.replace('_', ' ')}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {formatDuration(event.relativeTime)}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-600 mt-1">
                          {event.type === 'click' && Boolean(((event.data as Record<string, unknown>)?.target as Record<string, unknown>)?.textContent) && (
                            <span>Clicked: &quot;{String(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent)}&quot;</span>
                          )}
                          {event.type === 'click' && Boolean((event.data as Record<string, unknown>)?.coordinates) && (
                            <span className="ml-2">
                              @ ({String(((event.data as Record<string, unknown>).coordinates as Record<string, unknown>).x)}, {String(((event.data as Record<string, unknown>).coordinates as Record<string, unknown>).y)})
                            </span>
                          )}
                          {event.type === 'page_load' && (
                            <span>
                              {String((event.data as Record<string, unknown>)?.url || '')}
                              {Boolean((event.data as Record<string, unknown>)?.loadTime) && (
                                <span className="ml-2 text-green-600">
                                  {((event.data as Record<string, unknown>).loadTime as number).toFixed(0)}ms
                                </span>
                              )}
                            </span>
                          )}
                          {event.type === 'focus' && Boolean((event.data as Record<string, unknown>)?.target) && (
                            <span>
                              Focused: {String(((event.data as Record<string, unknown>).target as Record<string, unknown>).tagName)}
                              {Boolean(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent) && ` &quot;${(((event.data as Record<string, unknown>).target as Record<string, unknown>).textContent as string).slice(0, 30)}&quot;`}
                            </span>
                          )}
                          {event.type === 'input' && (
                            <span>User input detected</span>
                          )}
                          {event.type === 'visibility' && (
                            <span>
                              Page {(event.data as Record<string, unknown>)?.hidden ? 'hidden' : 'visible'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Click heatmap showing {analysis.clickPoints.length} recorded clicks
              </div>
              
              <div className="relative bg-gray-50 rounded-lg p-4 min-h-64">
                <div className="relative w-full h-48 bg-white rounded border overflow-hidden">
                  {analysis.clickPoints.map((click, index) => (
                    <div
                      key={index}
                      className="absolute w-3 h-3 bg-red-500 rounded-full opacity-70 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-150 transition-transform"
                      style={{
                        left: `${Math.min(95, Math.max(5, (click.x / 800) * 100))}%`,
                        top: `${Math.min(95, Math.max(5, (click.y / 600) * 100))}%`
                      }}
                      title={`${click.target} at (${click.x}, ${click.y})`}
                    />
                  ))}
                  
                  {analysis.clickPoints.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      No click data available
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {analysis.clickPoints.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Clicks</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {analysis.eventCounts.focus || 0}
                    </div>
                    <div className="text-sm text-gray-600">Focus Events</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="journey" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                User navigation path through {analysis.pageViews.length} pages
              </div>
              
              {analysis.pageViews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No page navigation data
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.pageViews.map((pageView, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {pageView.title || 'Unknown Page'}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {pageView.url}
                        </div>
                        <div className="text-xs text-gray-500">
                          Load time: {pageView.loadTime?.toFixed(0) || 0}ms
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDuration(pageView.timestamp - (events[0]?.timestamp || 0))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-blue-500" />
                    <div className="text-sm font-medium">Session Duration</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {formatDuration(analysis.totalDuration)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-green-500" />
                    <div className="text-sm font-medium">Avg Load Time</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {analysis.averageLoadTime.toFixed(0)}ms
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-purple-500" />
                    <div className="text-sm font-medium">Total Events</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {analysis.timeline.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Map className="size-4 text-orange-500" />
                    <div className="text-sm font-medium">Pages Visited</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {analysis.pageViews.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Event Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analysis.eventCounts)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            getEventColor(type)
                          )} />
                          <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}