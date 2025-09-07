'use client';

import { useState, useMemo, useCallback } from "react";
import { useErrors, useUpdateErrorStatus, useBulkUpdateErrorStatus } from "@/lib/hooks/useReviData";
import { useNotifications } from "@/components/ui/notification-provider";
import { ErrorListSkeleton } from "@/components/ui/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  IconCheckbox,
  IconUsers,
  IconTarget,
  IconBulb,
  IconFilter,
  IconAdjustments
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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ErrorDetailModal } from "./error-detail-model";
// Utility function to get status badge variant and color
const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'resolved':
      return { variant: 'secondary' as const, className: 'bg-green-100/50 dark:bg-green-500/10 text-green-800 dark:text-green-400 border-green-200 dark:border-green-700 backdrop-blur-sm' };
    case 'investigating':
      return { variant: 'secondary' as const, className: 'bg-yellow-100/50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700 backdrop-blur-sm' };
    case 'ignored':
      return { variant: 'secondary' as const, className: 'bg-gray-100/50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 backdrop-blur-sm' };
    case 'new':
    default:
      return { variant: 'destructive' as const, className: 'bg-red-500/20 dark:bg-red-500/20 backdrop-blur-sm border-red-200 dark:border-red-700' };
  }
};

export function ErrorListView() {
  const [page, setPage] = useState(1);
  const [selectedError, setSelectedError] = useState<ErrorWithSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedErrors, setSelectedErrors] = useState<Set<number>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<{
    dateRange?: string;
    sessionFilter?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    severity?: string[];
    errorType?: string;
    affectedUsers?: string;
    browserOs?: string;
  }>({});
  const limit = 20;

  const updateErrorStatus = useUpdateErrorStatus();
  const bulkUpdateErrorStatus = useBulkUpdateErrorStatus();
  const { addNotification } = useNotifications();

  // Multi-selection helpers
  const toggleErrorSelection = useCallback((errorId: number) => {
    setSelectedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  }, []);


  const clearSelection = useCallback(() => {
    setSelectedErrors(new Set());
  }, []);

  // We'll calculate these inside the component after filteredAndSortedErrors is available

  // Bulk operations
  const handleBulkStatusUpdate = useCallback(async (status: 'investigating' | 'resolved' | 'ignored', resolutionNotes?: string) => {
    if (selectedErrors.size === 0) return;
    
    try {
      await bulkUpdateErrorStatus.mutateAsync({
        errorIds: Array.from(selectedErrors),
        data: {
          status,
          resolution_notes: resolutionNotes
        }
      });
      
      addNotification({
        type: 'success',
        title: 'Bulk Update Successful',
        message: `Updated ${selectedErrors.size} errors to ${status}`,
        duration: 3000
      });
      
      clearSelection();
    } catch {
      addNotification({
        type: 'error',
        title: 'Bulk Update Failed',
        message: 'Failed to update selected errors. Please try again.',
        duration: 5000
      });
    }
  }, [selectedErrors, bulkUpdateErrorStatus, addNotification, clearSelection]);

  // Enhanced severity detection
  const getSeverityFromMetadata = useCallback((error: ErrorWithSession) => {
    const metadata = error.metadata || {};
    if (metadata.severity) return String(metadata.severity);
    
    // Auto-detect severity based on error patterns
    const message = error.message.toLowerCase();
    if (message.includes('uncaught') || message.includes('fatal') || message.includes('crash')) {
      return 'critical';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('failed')) {
      return 'high';
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return 'medium';
    }
    return 'low';
  }, []);

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
    
    // Apply severity filter
    if (filters.severity && filters.severity.length > 0) {
      filtered = filtered.filter(error => {
        const severity = getSeverityFromMetadata(error);
        return filters.severity!.includes(severity);
      });
    }
    
    // Apply error type filter
    if (filters.errorType && filters.errorType !== 'all') {
      filtered = filtered.filter(error => {
        const message = error.message.toLowerCase();
        switch (filters.errorType) {
          case 'javascript':
            return message.includes('script') || message.includes('js') || error.stack_trace?.includes('.js');
          case 'network':
            return message.includes('network') || message.includes('fetch') || message.includes('xhr');
          case 'ui':
            return message.includes('render') || message.includes('component') || message.includes('element');
          case 'api':
            return message.includes('api') || message.includes('endpoint') || message.includes('http');
          default:
            return true;
        }
      });
    }
    
    // Apply browser/OS filter
    if (filters.browserOs && filters.browserOs !== 'all') {
      filtered = filtered.filter(error => {
        const userAgent = error.user_agent?.toLowerCase() || '';
        return userAgent.includes(filters.browserOs!.toLowerCase());
      });
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
          case 'severity':
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            aVal = severityOrder[getSeverityFromMetadata(a) as keyof typeof severityOrder] || 1;
            bVal = severityOrder[getSeverityFromMetadata(b) as keyof typeof severityOrder] || 1;
            break;
          case 'frequency':
            // This would require backend grouping data
            aVal = 1;
            bVal = 1;
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
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 font-normal">
            <IconAlertCircle className="size-5" />
            Failed to load errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 font-light mb-4">
            Unable to connect to the error monitoring service.
          </p>
          <Button onClick={() => refetch()} variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
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

  // Bulk Actions Component
  const BulkActionsPanel = () => {
    if (selectedErrors.size === 0) return null;
    
    return (
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <IconCheckbox className="size-5 text-blue-600" />
                <span className="font-medium">
                  {selectedErrors.size} error{selectedErrors.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
                      <IconTarget className="size-4 mr-2" />
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('investigating')}>
                      Mark as Investigating
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('resolved')}>
                      Mark as Resolved
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('ignored')}>
                      Mark as Ignored
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Assign</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <IconUsers className="size-4 mr-2" />
                      Assign to Team
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <IconBulb className="size-4 mr-2" />
                      Merge Similar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearSelection}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm hover:bg-white/40 dark:hover:bg-gray-800/40 font-normal"
                >
                  <IconX className="size-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Advanced Filters Panel
  const AdvancedFiltersPanel = () => {
    if (!showAdvancedFilters) return null;
    
    return (
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal flex items-center gap-2 text-gray-800 dark:text-gray-200">
            <IconAdjustments className="size-4" />
            Advanced Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Severity Filter */}
            <div className="space-y-2">
              <label className="text-xs font-normal text-gray-600 dark:text-gray-400">SEVERITY</label>
              <div className="flex flex-wrap gap-2">
                {['critical', 'high', 'medium', 'low'].map(severity => {
                  const isSelected = filters.severity?.includes(severity) || false;
                  return (
                    <Button
                      key={severity}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setFilters(prev => {
                          const currentSeverity = prev.severity || [];
                          const newSeverity = isSelected
                            ? currentSeverity.filter(s => s !== severity)
                            : [...currentSeverity, severity];
                          return { ...prev, severity: newSeverity.length ? newSeverity : undefined };
                        });
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        severity === 'critical' ? 'bg-red-500' :
                        severity === 'high' ? 'bg-orange-500' :
                        severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      {severity}
                    </Button>
                  );
                })}
              </div>
            </div>
            
            {/* Error Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-normal text-gray-600 dark:text-gray-400">ERROR TYPE</label>
              <Select 
                value={filters.errorType || 'all'} 
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    errorType: value === 'all' ? undefined : value 
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="ui">UI/Render</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Browser/OS Filter */}
            <div className="space-y-2">
              <label className="text-xs font-normal text-gray-600 dark:text-gray-400">BROWSER/OS</label>
              <Select 
                value={filters.browserOs || 'all'} 
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    browserOs: value === 'all' ? undefined : value 
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="All Browsers" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                  <SelectItem value="all">All Browsers</SelectItem>
                  <SelectItem value="chrome">Chrome</SelectItem>
                  <SelectItem value="firefox">Firefox</SelectItem>
                  <SelectItem value="safari">Safari</SelectItem>
                  <SelectItem value="edge">Edge</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions Panel */}
      <BulkActionsPanel />
      
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search errors by message, URL, session ID, or stack trace..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filters.dateRange || "all"} onValueChange={(value) => 
              setFilters(prev => ({ 
                ...prev, 
                dateRange: value === "all" ? undefined : value 
              }))
            }>
              <SelectTrigger className="w-32 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
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
              <SelectTrigger className="w-40 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="All Errors" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
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
              <SelectTrigger className="w-36 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
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
              <SelectTrigger className="w-32 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="timestamp">Time</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="frequency">Frequency</SelectItem>
              </SelectContent>
            </Select>

            {filters.sortBy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"
              >
                {filters.sortOrder === 'asc' ? <IconSortAscending className="size-4" /> : <IconSortDescending className="size-4" />}
              </Button>
            )}

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
                <IconX className="size-4 mr-1" />
                Clear
              </Button>
            )}
            
            <Button 
              variant={showAdvancedFilters ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={showAdvancedFilters ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal" : "bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"}
            >
              <IconFilter className="size-4 mr-2" />
              Advanced
            </Button>
          </div>
        </div>
        
        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel />
      </div>

      {/* Error Stats and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
            {data?.total || 0} total errors
          </Badge>
          {errors.length !== (data?.total || 0) && (
            <Badge variant="secondary" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm font-light">
              {errors.length} filtered
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              disabled={isFetching}
              className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm hover:bg-white/40 dark:hover:bg-gray-800/40 font-normal"
            >
              <IconRefresh className={`size-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Updating...' : 'Refresh'}
            </Button>
            {isFetching && (
              <Badge variant="secondary" className="text-xs bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm font-light">
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
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"
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
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {errors.map((errorItem) => {
          const isSelected = selectedErrors.has(errorItem.id);
          const severity = getSeverityFromMetadata(errorItem);
          const severityColor = {
            critical: 'bg-red-500',
            high: 'bg-orange-500', 
            medium: 'bg-yellow-500',
            low: 'bg-green-500'
          }[severity];
          
          return (
            <Card 
              key={errorItem.id} 
              className={`bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-gray-800/40 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 bg-blue-50/30 dark:bg-blue-950/20' 
                  : 'cursor-pointer'
              }`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('[data-no-select]')) {
                  setSelectedError(errorItem);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <div data-no-select className="flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleErrorSelection(errorItem.id)}
                        className="mt-0.5"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${severityColor}`} title={`${severity} severity`} />
                        <IconAlertCircle className="size-4 text-destructive flex-shrink-0" />
                        <Badge variant="destructive" className="text-xs bg-red-500/20 dark:bg-red-500/20 backdrop-blur-sm border-red-200 dark:border-red-700">
                          Error #{errorItem.id}
                        </Badge>
                        <Badge variant="outline" className={`text-xs capitalize backdrop-blur-sm ${
                          severity === 'critical' ? 'text-red-600 border-red-200 bg-red-50/50 dark:bg-red-500/10' :
                          severity === 'high' ? 'text-orange-600 border-orange-200 bg-orange-50/50 dark:bg-orange-500/10' :
                          severity === 'medium' ? 'text-yellow-600 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-500/10' :
                          'text-green-600 border-green-200 bg-green-50/50 dark:bg-green-500/10'
                        }`}>
                          {severity}
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
                          <Badge variant="outline" className="text-xs bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 backdrop-blur-sm">
                            <IconUser className="size-3 mr-1" />
                            Session
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-normal text-sm leading-tight mb-2 break-words text-gray-800 dark:text-gray-200">
                        {errorItem.message}
                      </h3>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 font-light ml-8">
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
                      className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      data-no-select
                    >
                      <IconExternalLink className="size-3" />
                      View Session
                    </Link>
                  )}
                </div>
                
                {errorItem.url && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-light mt-2 p-2 bg-gray-100/30 dark:bg-gray-700/30 rounded font-mono break-all ml-8">
                    {errorItem.url}
                  </div>
                )}
              </CardHeader>
            </Card>
          );
        })}
        
        {errors.length === 0 && (
          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <IconAlertCircle className="size-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">
                {hasActiveFilters ? 'No errors match your filters' : 'No errors found'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 font-light mb-4">
                {hasActiveFilters 
                  ? 'Try adjusting your search criteria or filters.'
                  : 'Great news! No errors have been detected in the selected time range.'
                }
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
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