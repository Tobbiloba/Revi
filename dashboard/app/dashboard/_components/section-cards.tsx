'use client';

import React from "react";
import { IconTrendingDown, IconTrendingUp, IconAlertCircle, IconUsers, IconActivity, IconClock } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjectStats, useErrors } from "@/lib/hooks/useReviData";

interface SectionCardsProps {
  projectId?: number;
}

export function SectionCards({ projectId }: SectionCardsProps = {}) {
  // Stabilize query parameters to prevent infinite refetch loops
  const queryParams = React.useMemo(() => {
    // Round down to the nearest hour to prevent constant cache invalidation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setMinutes(0, 0, 0); // Round to nearest hour
    
    return {
      limit: 10,
      start_date: sevenDaysAgo.toISOString(),
    };
  }, []); // Empty deps array means this only calculates once per component mount

  // Auto-refresh every 5 seconds
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());


  // Refresh function
  const refresh = React.useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 1000); // Show refreshing for 1 second
  }, []);

  // Auto refresh every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [refresh]);

  const { data: stats, isLoading: statsLoading, error: statsError } = useProjectStats(projectId, 7, {
    // Use refreshKey to force refetch
    queryKey: ['projectStats', projectId, 7, refreshKey],
  });
  const { data: recentErrors, isLoading: errorsLoading, error: errorsError } = useErrors({
    ...queryParams,
    _refresh: refreshKey, // Force refetch with refresh key
  });

  const isLoading = statsLoading || errorsLoading;
  const error = statsError || errorsError;

  // Refresh status indicator
  const RefreshIndicator = () => (
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
      <div className="flex items-center gap-2">
        {isRefreshing ? (
          <>
            <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Refreshing data...</span>
          </>
        ) : (
          <>
            <div className="size-2 rounded-full bg-green-500" />
            <span>Auto-refresh every 5s • Last: {lastRefresh.toLocaleTimeString()}</span>
          </>
        )}
      </div>
      <button
        onClick={refresh}
        disabled={isRefreshing}
        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
      </button>
    </div>
  );

  if (isLoading && refreshKey === 0) { // Only show loading skeleton on initial load
    return (
      <>
        <RefreshIndicator />
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardDescription className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-24" />
                <CardTitle className="h-8 bg-gray-200/50 dark:bg-gray-700/50 rounded w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <RefreshIndicator />
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Connection Error</CardDescription>
              <CardTitle className="text-red-600 dark:text-red-400 font-normal">Failed to load data</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const projectStats = stats;
  const errors = recentErrors?.errors || [];
  const totalErrors = projectStats?.totalErrors || 0;
  const errorRate = projectStats?.errorRate || 0;
  const activeSessions = projectStats?.activeSessions || 0;
  const topErrorCount = projectStats?.topErrors?.[0]?.count || 0;

  
  // Calculate trends (simplified - in real app would compare to previous period)
  const errorTrend = errorRate > 0 ? (errorRate > 5 ? 'up' : 'stable') : 'down';
  const sessionTrend = activeSessions > 0 ? 'up' : 'stable';
  
  return (
    <div className="space-y-4">
      <RefreshIndicator />
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Total Errors</CardDescription>
            <CardTitle className="text-2xl font-light tabular-nums @[250px]/card:text-3xl text-gray-800 dark:text-gray-200 transition-all duration-500 ease-out">
              {totalErrors.toLocaleString()}
            </CardTitle>
          <CardAction>
            <Badge variant={errorTrend === 'up' ? 'destructive' : errorTrend === 'down' ? 'default' : 'secondary'} className="border-0 font-light">
              {errorTrend === 'up' ? <IconTrendingUp /> : errorTrend === 'down' ? <IconTrendingDown /> : <IconActivity />}
              {errorTrend === 'up' ? '+' : errorTrend === 'down' ? '-' : ''}{errorRate.toFixed(1)}/day
            </Badge>
          </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-normal text-gray-700 dark:text-gray-300">
              <IconAlertCircle className="size-4" />
              {totalErrors > 0 ? 'Errors detected this week' : 'No errors this week'}
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-light">
              Last 7 days activity
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Active Sessions</CardDescription>
            <CardTitle className="text-2xl font-light tabular-nums @[250px]/card:text-3xl text-gray-800 dark:text-gray-200 transition-all duration-500 ease-out">
              {activeSessions.toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                {sessionTrend === 'up' ? <IconTrendingUp /> : <IconActivity />}
                <span className="tabular-nums transition-all duration-300 ease-out">{activeSessions}</span> unique
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-normal text-gray-700 dark:text-gray-300">
              <IconUsers className="size-4" />
              User sessions tracked
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-light">
              Unique user interactions
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Top Error</CardDescription>
            <CardTitle className="text-2xl font-light tabular-nums @[250px]/card:text-3xl text-gray-800 dark:text-gray-200 transition-all duration-500 ease-out">
              {topErrorCount.toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                <IconAlertCircle />
                Most frequent
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-normal text-gray-700 dark:text-gray-300">
              {projectStats?.topErrors?.[0]?.message?.slice(0, 30) || 'No errors'}
              {projectStats?.topErrors?.[0]?.message && projectStats.topErrors[0].message.length > 30 && '...'}
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-light">
              Most common error type
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Latest Activity</CardDescription>
            <CardTitle className="text-2xl font-light tabular-nums @[250px]/card:text-3xl text-gray-800 dark:text-gray-200">
              {errors.length > 0 ? new Date(errors[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                <IconClock />
                Recent
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-normal text-gray-700 dark:text-gray-300">
              {errors.length > 0 ? 'Latest error detected' : 'No recent activity'}
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-light">
              Real-time monitoring
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
