'use client';

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
import { useDashboardData } from "@/lib/hooks/useReviData";

export function SectionCards() {
  const { stats, recentErrors, isLoading, error } = useDashboardData(7);
  const isUpdating = stats.isFetching || recentErrors.isFetching;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <CardDescription className="h-4 bg-muted rounded w-24" />
              <CardTitle className="h-8 bg-muted rounded w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Connection Error</CardDescription>
            <CardTitle className="text-destructive">Failed to load data</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const projectStats = stats.data;
  const errors = recentErrors.data?.errors || [];
  const totalErrors = projectStats?.totalErrors || 0;
  const errorRate = projectStats?.errorRate || 0;
  const activeSessions = projectStats?.activeSessions || 0;
  
  // Calculate trends (simplified - in real app would compare to previous period)
  const errorTrend = errorRate > 0 ? (errorRate > 5 ? 'up' : 'stable') : 'down';
  const sessionTrend = activeSessions > 0 ? 'up' : 'stable';
  
  return (
    <div className="space-y-4">
      {isUpdating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Updating dashboard data...</span>
        </div>
      )}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Errors</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalErrors.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant={errorTrend === 'up' ? 'destructive' : errorTrend === 'down' ? 'default' : 'secondary'}>
              {errorTrend === 'up' ? <IconTrendingUp /> : errorTrend === 'down' ? <IconTrendingDown /> : <IconActivity />}
              {errorTrend === 'up' ? '+' : errorTrend === 'down' ? '-' : ''}{errorRate.toFixed(1)}/day
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            <IconAlertCircle className="size-4" />
            {totalErrors > 0 ? 'Errors detected this week' : 'No errors this week'}
          </div>
          <div className="text-muted-foreground">
            Last 7 days activity
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Sessions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeSessions.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {sessionTrend === 'up' ? <IconTrendingUp /> : <IconActivity />}
              {activeSessions} unique
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            <IconUsers className="size-4" />
            User sessions tracked
          </div>
          <div className="text-muted-foreground">
            Unique user interactions
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Top Error</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {projectStats?.topErrors?.[0]?.count || 0}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconAlertCircle />
              Most frequent
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {projectStats?.topErrors?.[0]?.message?.slice(0, 30) || 'No errors'}
            {projectStats?.topErrors?.[0]?.message && projectStats.topErrors[0].message.length > 30 && '...'}
          </div>
          <div className="text-muted-foreground">
            Most common error type
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Latest Activity</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {errors.length > 0 ? new Date(errors[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconClock />
              Recent
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {errors.length > 0 ? 'Latest error detected' : 'No recent activity'}
          </div>
          <div className="text-muted-foreground">
            Real-time monitoring
          </div>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
