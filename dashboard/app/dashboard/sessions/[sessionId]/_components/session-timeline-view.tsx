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
          <div className="h-8 bg-muted rounded w-64 mb-2" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
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
            <Button variant="ghost" size="sm">
              <IconChevronLeft className="size-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <IconAlertCircle className="size-5" />
              Failed to load session timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Unable to retrieve session data for session ID: {sessionId}
            </p>
            <Button onClick={() => refetch()} variant="outline">
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
            <Button variant="ghost" size="sm">
              <IconChevronLeft className="size-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Session Timeline
            </h1>
            <p className="text-muted-foreground">
              Session ID: {sessionId}
            </p>
          </div>
        </div>
        
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <IconRefresh className="size-4 mr-2" />
          Refresh
        </Button>
      </div>

      {sessionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="size-5" />
              Session Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started At</p>
                <p className="text-sm">
                  {new Date(sessionInfo.started_at).toLocaleString()}
                </p>
              </div>
              {sessionInfo.ended_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ended At</p>
                  <p className="text-sm">
                    {new Date(sessionInfo.ended_at).toLocaleString()}
                  </p>
                </div>
              )}
              {sessionInfo.user_id && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="text-sm">{sessionInfo.user_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project ID</p>
                <p className="text-sm">{sessionInfo.project_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p className="text-sm">
                  {sessionInfo.ended_at 
                    ? `${Math.round((new Date(sessionInfo.ended_at).getTime() - new Date(sessionInfo.started_at).getTime()) / 1000)} seconds`
                    : 'Ongoing'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-sm">{events.length}</p>
              </div>
            </div>
            
            {Object.keys(sessionInfo.metadata || {}).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Session Metadata</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(sessionInfo.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Event Timeline</h2>
          <Badge variant="outline">
            {events.length} events
          </Badge>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <IconActivity className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground">
                No events have been recorded for this session yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
            
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
      <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-background border-2 border-border rounded-full">
        {getEventIcon(event.event_type, event.source)}
      </div>
      
      <Card className={`flex-1 border-l-4 ${getEventColor(event.source)}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant={event.source === 'error' ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {event.source}
                </Badge>
                <span className="text-sm font-medium">{event.event_type}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconClock className="size-3" />
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        
        {Object.keys(event.data || {}).length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-sm font-medium">Event Data</p>
              <div className="bg-muted p-3 rounded text-xs">
                {event.source === 'error' ? (
                  <div className="space-y-2">
                    {typeof eventData.message === 'string' && eventData.message && (
                      <div>
                        <span className="font-medium">Message:</span>
                        <p className="mt-1 break-words">{eventData.message}</p>
                      </div>
                    )}
                    {typeof eventData.stack_trace === 'string' && eventData.stack_trace && (
                      <div>
                        <span className="font-medium">Stack Trace:</span>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
                          {eventData.stack_trace}
                        </pre>
                      </div>
                    )}
                    {typeof eventData.url === 'string' && eventData.url && (
                      <div>
                        <span className="font-medium">URL:</span>
                        <p className="mt-1 break-all font-mono">{eventData.url}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words">
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