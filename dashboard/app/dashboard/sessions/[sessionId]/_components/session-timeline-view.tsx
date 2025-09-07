'use client';

import { useSessionEvents } from "@/lib/hooks/useReviData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  IconAlertCircle, 
  IconUser, 
  IconClock,
  IconRefresh,
  IconNetwork,
  IconChevronLeft,
  IconActivity
} from "@tabler/icons-react";
import { SessionEventData } from "@/lib/revi-api";
import Link from "next/link";

interface SessionTimelineViewProps {
  sessionId: string;
}

export function SessionTimelineView({ sessionId }: SessionTimelineViewProps) {
  const { data, isLoading, error, refetch } = useSessionEvents(sessionId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100/30 dark:bg-gray-700/30 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-100/30 dark:bg-gray-700/30 rounded w-48" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-100/30 dark:bg-gray-700/30 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100/30 dark:bg-gray-700/30 rounded w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sessions">
            <Button variant="ghost" size="sm" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm hover:bg-white/40 dark:hover:bg-gray-800/40 font-normal">
              <IconChevronLeft className="size-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
        </div>
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 font-normal">
              <IconAlertCircle className="size-5" />
              Failed to load session timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 font-light mb-4">
              Unable to retrieve session data for session ID: {sessionId}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
              <IconRefresh className="size-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const events = data?.events || [];
  const sessionInfo = data?.session_info;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sessions">
            <Button variant="ghost" size="sm" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm hover:bg-white/40 dark:hover:bg-gray-800/40 font-normal">
              <IconChevronLeft className="size-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
              Session Timeline
            </h1>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              Session ID: {sessionId}
            </p>
          </div>
        </div>
        
        <Button onClick={() => refetch()} variant="outline" size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
          <IconRefresh className="size-4 mr-2" />
          Refresh
        </Button>
      </div>

      {sessionInfo && (
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
              <IconUser className="size-5" />
              Session Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-normal text-gray-600 dark:text-gray-400">Started At</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-light">
                  {new Date(sessionInfo.started_at).toLocaleString()}
                </p>
              </div>
              {sessionInfo.ended_at && (
                <div>
                  <p className="text-sm font-normal text-gray-600 dark:text-gray-400">Ended At</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-light">
                    {new Date(sessionInfo.ended_at).toLocaleString()}
                  </p>
                </div>
              )}
              {sessionInfo.user_id && (
                <div>
                  <p className="text-sm font-normal text-gray-600 dark:text-gray-400">User ID</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-light">{sessionInfo.user_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-normal text-gray-600 dark:text-gray-400">Project ID</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-light">{sessionInfo.project_id}</p>
              </div>
              <div>
                <p className="text-sm font-normal text-gray-600 dark:text-gray-400">Duration</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-light">
                  {sessionInfo.ended_at 
                    ? `${Math.round((new Date(sessionInfo.ended_at).getTime() - new Date(sessionInfo.started_at).getTime()) / 1000)} seconds`
                    : 'Ongoing'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-normal text-gray-600 dark:text-gray-400">Total Events</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-light">{events.length}</p>
              </div>
            </div>
            
            {Object.keys(sessionInfo.metadata || {}).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mb-2">Session Metadata</p>
                <pre className="text-xs bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded overflow-x-auto text-gray-700 dark:text-gray-300 font-light backdrop-blur-sm border border-gray-200 dark:border-gray-600">
                  {JSON.stringify(sessionInfo.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-normal text-gray-800 dark:text-gray-200">Event Timeline</h2>
          <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
            {events.length} events
          </Badge>
        </div>

        {events.length === 0 ? (
          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <IconActivity className="size-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No events found</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light">
                No events have been recorded for this session yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            
            <div className="space-y-6">
              {events.map((event, index) => (
                <EventCard key={event.id} event={event} isLast={index === events.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: SessionEventData; isLast: boolean }) {
  const eventData = event.data as Record<string, unknown>;
  const getEventIcon = (eventType: string, source: string) => {
    switch (source) {
      case 'error':
        return <IconAlertCircle className="size-5 text-destructive" />;
      case 'network':
        return <IconNetwork className="size-5 text-blue-500" />;
      case 'session':
      default:
        return <IconActivity className="size-5 text-primary" />;
    }
  };

  const getEventColor = (source: string) => {
    switch (source) {
      case 'error':
        return 'border-l-destructive';
      case 'network':
        return 'border-l-blue-500';
      case 'session':
      default:
        return 'border-l-primary';
    }
  };

  return (
    <div className="relative flex items-start gap-4">
      {/* Timeline dot */}
      <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
        {getEventIcon(event.event_type, event.source)}
      </div>
      
      <Card className={`flex-1 border-l-4 ${getEventColor(event.source)} bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant={event.source === 'error' ? 'destructive' : 'outline'}
                  className={`text-xs ${
                    event.source === 'error' 
                      ? 'bg-red-500/20 dark:bg-red-500/20 backdrop-blur-sm border-red-200 dark:border-red-700'
                      : event.source === 'network'
                      ? 'bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 backdrop-blur-sm'
                      : 'bg-gray-50/50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 backdrop-blur-sm'
                  }`}
                >
                  {event.source}
                </Badge>
                <span className="text-sm font-normal text-gray-800 dark:text-gray-200">{event.event_type}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
                <IconClock className="size-3" />
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        
        {Object.keys(event.data || {}).length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-sm font-normal text-gray-800 dark:text-gray-200">Event Data</p>
              <div className="bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded text-xs backdrop-blur-sm border border-gray-200 dark:border-gray-600">
                {event.source === 'error' ? (
                  <div className="space-y-2">
                    {typeof eventData.message === 'string' && eventData.message && (
                      <div>
                        <span className="font-normal text-gray-700 dark:text-gray-300">Message:</span>
                        <p className="mt-1 break-words text-gray-800 dark:text-gray-200 font-light">{eventData.message}</p>
                      </div>
                    )}
                    {typeof eventData.stack_trace === 'string' && eventData.stack_trace && (
                      <div>
                        <span className="font-normal text-gray-700 dark:text-gray-300">Stack Trace:</span>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-300 font-light">
                          {eventData.stack_trace}
                        </pre>
                      </div>
                    )}
                    {typeof eventData.url === 'string' && eventData.url && (
                      <div>
                        <span className="font-normal text-gray-700 dark:text-gray-300">URL:</span>
                        <p className="mt-1 break-all font-mono text-gray-800 dark:text-gray-200 font-light">{eventData.url}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300 font-light">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}