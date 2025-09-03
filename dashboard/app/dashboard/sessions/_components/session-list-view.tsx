'use client';

import { useState, useMemo } from "react";
import { useSessions } from "@/lib/hooks/useReviData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconSearch, 
  IconCalendar, 
  IconUser, 
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconAlertCircle,
  IconX
} from "@tabler/icons-react";
import { ListSessionsParams } from "@/lib/revi-api";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SessionListView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    hasErrors?: boolean;
    dateRange?: string;
    userId?: string;
  }>({});
  const limit = 20;

  // Build query parameters
  const queryParams = useMemo((): ListSessionsParams => {
    const params: ListSessionsParams = {
      page,
      limit,
    };

    if (filters.hasErrors !== undefined) {
      params.has_errors = filters.hasErrors;
    }

    if (filters.dateRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.dateRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      params.start_date = startDate.toISOString();
    }

    if (filters.userId) {
      params.user_id = filters.userId;
    }

    return params;
  }, [page, filters]);

  const { data, isLoading, error, refetch, isFetching } = useSessions(queryParams);

  // Filter sessions by search term on the frontend
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];
    
    if (!searchTerm) return data.sessions;
    
    const lowerSearch = searchTerm.toLowerCase();
    return data.sessions.filter(session => 
      session.session_id.toLowerCase().includes(lowerSearch) ||
      session.user_id?.toLowerCase().includes(lowerSearch) ||
      session.last_error?.toLowerCase().includes(lowerSearch) ||
      session.user_agent?.toLowerCase().includes(lowerSearch)
    );
  }, [data?.sessions, searchTerm]);

  const clearFilters = () => {
    setFilters({});
    setSearchTerm("");
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            Failed to load sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to connect to the session monitoring service.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="size-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sessions = filteredSessions;
  const totalPages = Math.ceil((data?.total || 0) / limit);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            placeholder="Search sessions by ID, user, or error message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={filters.hasErrors?.toString() || "all"} onValueChange={(value) => 
            setFilters(prev => ({ 
              ...prev, 
              hasErrors: value === "all" ? undefined : value === "true" 
            }))
          }>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              <SelectItem value="true">With Errors</SelectItem>
              <SelectItem value="false">No Errors</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.dateRange || "all"} onValueChange={(value) => 
            setFilters(prev => ({ 
              ...prev, 
              dateRange: value === "all" ? undefined : value 
            }))
          }>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
              <SelectItem value="30d">Last 30d</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <IconX className="size-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Session Stats and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {data?.total || 0} total sessions
          </Badge>
          {sessions.length !== (data?.total || 0) && (
            <Badge variant="secondary">
              {sessions.length} filtered
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              disabled={isFetching}
            >
              <IconRefresh className={`size-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Updating...' : 'Refresh'}
            </Button>
            {isFetching && (
              <Badge variant="secondary" className="text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                Live
              </Badge>
            )}
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <IconChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card 
            key={session.session_id} 
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {session.session_id.slice(0, 8)}...
                    </Badge>
                    {session.error_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {session.error_count} error{session.error_count > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {session.user_id && (
                      <Badge variant="secondary" className="text-xs">
                        User
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <IconCalendar className="size-3" />
                        {session.started_at.toLocaleDateString()} at{' '}
                        {session.started_at.toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <IconClock className="size-3" />
                        {formatDuration(session.duration)}
                      </div>
                      {session.user_id && (
                        <div className="flex items-center gap-1">
                          <IconUser className="size-3" />
                          {session.user_id}
                        </div>
                      )}
                    </div>
                  </div>

                  {session.last_error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mt-2 break-words">
                      <span className="font-medium">Last Error: </span>
                      {session.last_error}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{session.event_count} events</span>
                      {session.user_agent && (
                        <span className="truncate max-w-xs">
                          {session.user_agent.split(' ')[0]}
                        </span>
                      )}
                    </div>
                    
                    <Link
                      href={`/dashboard/sessions/${session.session_id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View Timeline →
                    </Link>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        
        {sessions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <IconUser className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {hasActiveFilters ? 'No sessions match your filters' : 'No sessions found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? 'Try adjusting your search criteria or filters.'
                  : 'User sessions will appear here once your application starts sending data.'
                }
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline">
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}