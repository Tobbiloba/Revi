'use client';

import { useState, useMemo } from "react";
import { useErrors, useUpdateErrorStatus } from "@/lib/hooks/useReviData";
import { useNotifications } from "@/components/ui/notification-provider";
import { ErrorListSkeleton } from "@/components/ui/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconAlertCircle, 
  IconCalendar, 
  IconUser, 
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconCopy
} from "@tabler/icons-react";
import { ErrorWithSession, ListErrorsParams } from "@/lib/revi-api";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Utility function to get status badge variant and color
const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'resolved':
      return { variant: 'secondary' as const, className: 'bg-green-100 text-green-800 border-green-200' };
    case 'investigating':
      return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 'ignored':
      return { variant: 'secondary' as const, className: 'bg-gray-100 text-gray-600 border-gray-200' };
    case 'new':
    default:
      return { variant: 'destructive' as const, className: '' };
  }
};

export function ErrorListView() {
  const [page, setPage] = useState(1);
  const [selectedError, setSelectedError] = useState<ErrorWithSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    dateRange?: string;
    sessionFilter?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }>({});
  const limit = 20;

  const updateErrorStatus = useUpdateErrorStatus();
  const { addNotification } = useNotifications();

  // Build query parameters
  const queryParams = useMemo((): ListErrorsParams => {
    const params: ListErrorsParams = {
      page,
      limit,
    };

    if (filters.dateRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.dateRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
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
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      
      params.start_date = startDate.toISOString();
    }

    return params;
  }, [page, filters]);

  const { data, isLoading, error, refetch, isFetching } = useErrors(queryParams);

  // Filter and sort errors on the frontend - moved before early returns
  const filteredAndSortedErrors = useMemo(() => {
    if (!data?.errors) return [];
    
    let filtered = data.errors;
    
    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(error => 
        error.message.toLowerCase().includes(lowerSearch) ||
        error.url?.toLowerCase().includes(lowerSearch) ||
        error.session_id?.toLowerCase().includes(lowerSearch) ||
        error.session_user_id?.toLowerCase().includes(lowerSearch) ||
        error.stack_trace?.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Apply session filter
    if (filters.sessionFilter === 'with_session') {
      filtered = filtered.filter(error => error.session_id);
    } else if (filters.sessionFilter === 'without_session') {
      filtered = filtered.filter(error => !error.session_id);
    }
    
    // Apply status filter
    if (filters.status) {
      const status = filters.status as 'new' | 'investigating' | 'resolved' | 'ignored';
      filtered = filtered.filter(error => (error.status || 'new') === status);
    }
    
    // Apply sorting
    if (filters.sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number, bVal: string | number;
        
        switch (filters.sortBy) {
          case 'timestamp':
            aVal = new Date(a.timestamp).getTime();
            bVal = new Date(b.timestamp).getTime();
            break;
          case 'message':
            aVal = a.message.toLowerCase();
            bVal = b.message.toLowerCase();
            break;
          case 'url':
            aVal = a.url?.toLowerCase() || '';
            bVal = b.url?.toLowerCase() || '';
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [data?.errors, searchTerm, filters]);

  if (isLoading) {
    return <ErrorListSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            Failed to load errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to connect to the error monitoring service.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="size-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const errors = filteredAndSortedErrors;
  const totalPages = Math.ceil((data?.total || 0) / limit);

  const clearFilters = () => {
    setFilters({});
    setSearchTerm("");
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm;

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search errors by message, URL, session ID, or stack trace..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
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
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sessionFilter || "all"} onValueChange={(value) => 
              setFilters(prev => ({ 
                ...prev, 
                sessionFilter: value === "all" ? undefined : value 
              }))
            }>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Errors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Errors</SelectItem>
                <SelectItem value="with_session">With Session</SelectItem>
                <SelectItem value="without_session">No Session</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status || "all"} onValueChange={(value) => 
              setFilters(prev => ({ 
                ...prev, 
                status: value === "all" ? undefined : value 
              }))
            }>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy || "default"} onValueChange={(value) => 
              setFilters(prev => ({ 
                ...prev, 
                sortBy: value === "default" ? undefined : value 
              }))
            }>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="timestamp">Time</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>

            {filters.sortBy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
              >
                {filters.sortOrder === 'asc' ? <IconSortAscending className="size-4" /> : <IconSortDescending className="size-4" />}
              </Button>
            )}

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <IconX className="size-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error Stats and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {data?.total || 0} total errors
          </Badge>
          {errors.length !== (data?.total || 0) && (
            <Badge variant="secondary">
              {errors.length} filtered
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

      <div className="grid gap-4">
        {errors.map((errorItem) => (
          <Card 
            key={errorItem.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedError(errorItem)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <IconAlertCircle className="size-4 text-destructive flex-shrink-0" />
                    <Badge variant="destructive" className="text-xs">
                      Error #{errorItem.id}
                    </Badge>
                    {(() => {
                      const statusBadge = getStatusBadge(errorItem.status || 'new');
                      return (
                        <Badge 
                          variant={statusBadge.variant} 
                          className={`text-xs capitalize ${statusBadge.className}`}
                        >
                          {errorItem.status || 'new'}
                        </Badge>
                      );
                    })()}
                    {errorItem.session_id && (
                      <Badge variant="outline" className="text-xs">
                        Session
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight mb-2 break-words">
                    {errorItem.message}
                  </h3>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <IconCalendar className="size-3" />
                    {new Date(errorItem.timestamp).toLocaleDateString()} at{' '}
                    {new Date(errorItem.timestamp).toLocaleTimeString()}
                  </div>
                  {errorItem.session_user_id && (
                    <div className="flex items-center gap-1">
                      <IconUser className="size-3" />
                      User {errorItem.session_user_id}
                    </div>
                  )}
                </div>
                
                {errorItem.session_id && (
                  <Link
                    href={`/dashboard/sessions/${errorItem.session_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <IconExternalLink className="size-3" />
                    View Session
                  </Link>
                )}
              </div>
              
              {errorItem.url && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded font-mono break-all">
                  {errorItem.url}
                </div>
              )}
            </CardHeader>
          </Card>
        ))}
        
        {errors.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <IconAlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {hasActiveFilters ? 'No errors match your filters' : 'No errors found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? 'Try adjusting your search criteria or filters.'
                  : 'Great news! No errors have been detected in the selected time range.'
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

      {selectedError && (
        <ErrorDetailModal
          error={selectedError}
          onClose={() => setSelectedError(null)}
          onStatusUpdate={(errorId, data) => {
            updateErrorStatus.mutate({ errorId, data }, {
              onSuccess: () => {
                addNotification({
                  type: 'success',
                  title: 'Status Updated',
                  message: `Error #${errorId} status changed to ${data.status}`,
                  duration: 3000
                });
                setSelectedError(null);
              },
              onError: () => {
                addNotification({
                  type: 'error',
                  title: 'Update Failed',
                  message: 'Failed to update error status. Please try again.',
                  duration: 5000
                });
              }
            });
          }}
        />
      )}
    </div>
  );
}

function ErrorDetailModal({ 
  error, 
  onClose,
  onStatusUpdate
}: { 
  error: ErrorWithSession; 
  onClose: () => void;
  onStatusUpdate: (errorId: number, data: { status: 'new' | 'investigating' | 'resolved' | 'ignored'; resolution_notes?: string }) => void;
}) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<'new' | 'investigating' | 'resolved' | 'ignored'>(error.status || 'new');
  const [resolutionNotes, setResolutionNotes] = useState(error.resolution_notes || '');
  const { addNotification } = useNotifications();

  const handleStatusUpdate = () => {
    setIsUpdatingStatus(true);
    onStatusUpdate(error.id, { 
      status: newStatus, 
      resolution_notes: resolutionNotes || undefined 
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addNotification({
      type: 'success',
      title: 'Copied to Clipboard',
      message: `${label} has been copied to your clipboard`,
      duration: 2000
    });
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 mb-2">
                <IconAlertCircle className="size-5 text-destructive" />
                Error #{error.id}
                {(() => {
                  const statusBadge = getStatusBadge(error.status || 'new');
                  return (
                    <Badge 
                      variant={statusBadge.variant} 
                      className={`text-xs capitalize ${statusBadge.className}`}
                    >
                      {error.status || 'new'}
                    </Badge>
                  );
                })()}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(error.timestamp).toLocaleString()}
              </p>
              
              {/* Status Management */}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Status:</label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'new' | 'investigating' | 'resolved' | 'ignored')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handleStatusUpdate} 
                  size="sm" 
                  disabled={isUpdatingStatus || newStatus === (error.status || 'new')}
                >
                  {isUpdatingStatus ? 'Updating...' : 'Update Status'}
                </Button>
              </div>

              {(newStatus === 'resolved' || newStatus === 'ignored') && (
                <div className="mt-3">
                  <label className="text-sm font-medium mb-2 block">Resolution Notes:</label>
                  <Textarea
                    placeholder="Add notes about the resolution..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="text-sm"
                    rows={3}
                  />
                </div>
              )}
            </div>
            
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Error Message</h4>
              <p className="text-sm bg-muted p-3 rounded break-words">
                {error.message}
              </p>
            </div>
            
            {error.stack_trace && (
              <div>
                <h4 className="font-semibold mb-2">Stack Trace</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {error.stack_trace}
                </pre>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {error.url && (
                <div>
                  <h4 className="font-semibold mb-2">URL</h4>
                  <p className="text-sm bg-muted p-3 rounded font-mono break-all">
                    {error.url}
                  </p>
                </div>
              )}
              
              {error.user_agent && (
                <div>
                  <h4 className="font-semibold mb-2">User Agent</h4>
                  <p className="text-xs bg-muted p-3 rounded break-words">
                    {error.user_agent}
                  </p>
                </div>
              )}
            </div>
            
            {error.session_id && (
              <div>
                <h4 className="font-semibold mb-2">Session Information</h4>
                <div className="bg-muted p-3 rounded space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Session ID:</span> {error.session_id}
                  </p>
                  {error.session_user_id && (
                    <p className="text-sm">
                      <span className="font-medium">User ID:</span> {error.session_user_id}
                    </p>
                  )}
                  <Link
                    href={`/dashboard/sessions/${error.session_id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <IconExternalLink className="size-3" />
                    View Full Session Timeline
                  </Link>
                </div>
              </div>
            )}
            
            {/* Error Context & Environment */}
            <div>
              <h4 className="font-semibold mb-2">Error Context</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Browser Information */}
                {error.user_agent && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Browser Details</h5>
                    <div className="bg-muted p-3 rounded text-xs">
                      <div className="space-y-1">
                        <div><span className="font-medium">User Agent:</span></div>
                        <div className="font-mono break-all">{error.user_agent}</div>
                        {(() => {
                          const ua = error.user_agent;
                          const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge)\/([0-9.]+)/);
                          const osMatch = ua.match(/\(([^)]+)\)/);
                          return (
                            <div className="mt-2 space-y-1">
                              {browserMatch && (
                                <div><span className="font-medium">Browser:</span> {browserMatch[1]} {browserMatch[2]}</div>
                              )}
                              {osMatch && (
                                <div><span className="font-medium">OS:</span> {osMatch[1]}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Frequency */}
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Error Pattern</h5>
                  <div className="bg-muted p-3 rounded text-xs space-y-1">
                    <div><span className="font-medium">First Occurrence:</span> {new Date(error.timestamp).toLocaleString()}</div>
                    <div><span className="font-medium">Error ID:</span> #{error.id}</div>
                    <div><span className="font-medium">Project:</span> #{error.project_id}</div>
                    {error.session_id && (
                      <div><span className="font-medium">Session Context:</span> Available</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Debug Breadcrumbs */}
            <div>
              <h4 className="font-semibold mb-2">Debug Information</h4>
              <div className="space-y-3">
                {/* Error Location Breadcrumb */}
                {error.stack_trace && (
                  <div>
                    <h5 className="font-medium text-sm mb-2">Error Location</h5>
                    <div className="bg-muted/50 border-l-4 border-destructive p-3 rounded-r">
                      {(() => {
                        const firstLine = error.stack_trace.split('\\n')[0];
                        const locationMatch = firstLine.match(/at (.+) \\((.+):([0-9]+):([0-9]+)\\)/);
                        if (locationMatch) {
                          return (
                            <div className="text-sm space-y-1">
                              <div className="font-mono"><span className="font-medium">Function:</span> {locationMatch[1]}</div>
                              <div className="font-mono"><span className="font-medium">File:</span> {locationMatch[2]}</div>
                              <div className="font-mono"><span className="font-medium">Line:</span> {locationMatch[3]}:{locationMatch[4]}</div>
                            </div>
                          );
                        } else {
                          return <div className="text-sm font-mono">{firstLine}</div>;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Page Context */}
                {error.url && (
                  <div>
                    <h5 className="font-medium text-sm mb-2">Page Context</h5>
                    <div className="bg-muted/50 border-l-4 border-blue-500 p-3 rounded-r">
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">URL:</span></div>
                        <div className="font-mono break-all">{error.url}</div>
                        {(() => {
                          try {
                            const url = new URL(error.url);
                            return (
                              <div className="mt-2 space-y-1">
                                <div><span className="font-medium">Domain:</span> {url.hostname}</div>
                                <div><span className="font-medium">Path:</span> {url.pathname}</div>
                                {url.search && <div><span className="font-medium">Query:</span> {url.search}</div>}
                                {url.hash && <div><span className="font-medium">Hash:</span> {url.hash}</div>}
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Similar Errors Hint */}
                <div>
                  <h5 className="font-medium text-sm mb-2">Investigation Hints</h5>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                    <div className="text-sm space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Related Errors:</span> Search for similar error messages in your logs
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">User Impact:</span> {error.session_id ? 'User session affected - check timeline' : 'No user session data available'}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Browser Compatibility:</span> {error.user_agent ? 'Check if error is browser-specific' : 'No browser information available'}
                        </div>
                      </div>
                      {error.url && (
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Page Analysis:</span> Test the affected page manually for reproduction
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Items */}
            <div>
              <h4 className="font-semibold mb-2">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                {error.session_id && (
                  <Link href={`/dashboard/sessions/${error.session_id}`}>
                    <Button variant="outline" size="sm">
                      <IconExternalLink className="size-4 mr-2" />
                      View Session Timeline
                    </Button>
                  </Link>
                )}
                {error.url && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(error.url, '_blank')}
                  >
                    <IconExternalLink className="size-4 mr-2" />
                    Open Error Page
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCopy(JSON.stringify({
                    id: error.id,
                    message: error.message,
                    url: error.url,
                    timestamp: error.timestamp,
                    stack_trace: error.stack_trace
                  }, null, 2), 'Error details')}
                >
                  <IconCopy className="size-4 mr-2" />
                  Copy Error Details
                </Button>
                <Button variant="outline" size="sm">
                  <IconAlertCircle className="size-4 mr-2" />
                  Search Similar Errors
                </Button>
              </div>
            </div>

            {Object.keys(error.metadata || {}).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Additional Metadata</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(error.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}