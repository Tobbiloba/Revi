'use client';

import * as React from "react";
import { useMemo, useRef, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

import { useProjectStats, useReviQueryClient } from "@/lib/hooks/useReviData";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconBrowser,
  IconDeviceMobile,
  IconAlertCircle,
  IconClock,
  IconUsers,
  IconRefresh,
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const MAX_CHART_ITEMS = 8;
const MIN_VALUE_THRESHOLD = 0.5; // 0.5% minimum threshold for chart visibility

interface ChartData {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
}

const sampleAndAggregateData = (data: ChartData[], maxItems: number = MAX_CHART_ITEMS): ChartData[] => {
  if (!data || data.length <= maxItems) {
    return data;
  }

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  const visibleItems = sortedData.slice(0, maxItems - 1);
  const remainingItems = sortedData.slice(maxItems - 1);
  
  if (remainingItems.length === 0) {
    return visibleItems;
  }

  const othersValue = remainingItems.reduce((sum, item) => sum + item.value, 0);
  const othersPercentage = (othersValue / totalValue) * 100;

  if (othersValue > 0) {
    visibleItems.push({
      name: `Others (${remainingItems.length})`,
      value: othersValue,
      percentage: othersPercentage,
    });
  }

  return visibleItems;
};

const filterLowValueItems = (data: ChartData[], threshold: number = MIN_VALUE_THRESHOLD): ChartData[] => {
  if (!data) return [];
  
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return data;

  const filtered = data.filter(item => {
    const percentage = (item.value / totalValue) * 100;
    return percentage >= threshold;
  });

  const lowValueItems = data.filter(item => {
    const percentage = (item.value / totalValue) * 100;
    return percentage < threshold;
  });

  if (lowValueItems.length === 0) {
    return filtered;
  }

  const lowValueSum = lowValueItems.reduce((sum, item) => sum + item.value, 0);
  const lowValuePercentage = (lowValueSum / totalValue) * 100;

  if (lowValueSum > 0) {
    filtered.push({
      name: `Others (${lowValueItems.length} items)`,
      value: lowValueSum,
      percentage: lowValuePercentage,
    });
  }

  return filtered;
};

const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);
        
        if (isVisible && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasIntersected, options]);

  return { elementRef, isIntersecting, hasIntersected };
};

interface LazyChartWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

const LazyChartWrapper = ({ children, fallback, className }: LazyChartWrapperProps) => {
  const { elementRef, hasIntersected } = useIntersectionObserver();

  return (
    <div ref={elementRef} className={className}>
      {hasIntersected ? (
        children
      ) : (
        fallback || (
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32 mb-2" />
              <div className="h-4 bg-muted rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
};

interface BrowserDistributionChartProps {
  data: ChartData[];
}

const BrowserDistributionChart = React.memo(({ data }: BrowserDistributionChartProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconBrowser className="size-5" />
        Browser Distribution
      </CardTitle>
      <CardDescription>
        Errors by browser type ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} total)
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percentage }) => `${name} ${percentage?.toFixed(1)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`browser-cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
));
BrowserDistributionChart.displayName = 'BrowserDistributionChart';

interface OSDistributionChartProps {
  data: ChartData[];
}

const OSDistributionChart = React.memo(({ data }: OSDistributionChartProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconDeviceMobile className="size-5" />
        Operating System
      </CardTitle>
      <CardDescription>
        Errors by operating system ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} total)
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percentage }) => `${name} ${percentage?.toFixed(1)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`os-cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
));
OSDistributionChart.displayName = 'OSDistributionChart';

interface ErrorStatusChartProps {
  data: ChartData[];
}

const ErrorStatusChart = React.memo(({ data }: ErrorStatusChartProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconAlertCircle className="size-5" />
        Error Status
      </CardTitle>
      <CardDescription>
        Current error resolution status
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8">
              {data.map((entry, index) => (
                <Cell key={`status-cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
));
ErrorStatusChart.displayName = 'ErrorStatusChart';

interface KeyMetricsSectionProps {
  uniqueUsers: number;
  averageSessionDuration: number;
  errorRate: number;
  totalErrors: number;
  errorsByStatus: Record<string, number> | undefined;
}

const KeyMetricsSection = React.memo(({ 
  uniqueUsers, 
  averageSessionDuration, 
  errorRate, 
  totalErrors, 
  errorsByStatus 
}: KeyMetricsSectionProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Unique Users</CardDescription>
        <CardTitle className="text-2xl font-semibold">
          {uniqueUsers?.toLocaleString() || 0}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconUsers className="size-4" />
          <span>Active users tracked</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Avg. Session Duration</CardDescription>
        <CardTitle className="text-2xl font-semibold">
          {averageSessionDuration ? 
            `${Math.round(averageSessionDuration / 60)}m` : '0m'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconClock className="size-4" />
          <span>Average user session</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Error Rate</CardDescription>
        <CardTitle className="text-2xl font-semibold">
          {(errorRate || 0).toFixed(1)}/day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconAlertCircle className="size-4" />
          <span>Daily error occurrence</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Resolution Rate</CardDescription>
        <CardTitle className="text-2xl font-semibold">
          {totalErrors > 0 ? 
            Math.round((errorsByStatus?.resolved || 0) / totalErrors * 100) : 0}%
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconAlertCircle className="size-4" />
          <span>Errors resolved</span>
        </div>
      </CardContent>
    </Card>
  </div>
));
KeyMetricsSection.displayName = 'KeyMetricsSection';

interface AnalyticsDashboardProps {
  projectId?: number;
}

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps = {}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const queryClient = useReviQueryClient();

  // Prefetch data for other time ranges on component mount
  React.useEffect(() => {
    if (projectId) {
      // Prefetch 30-day data if currently on 7-day view
      if (days === 7) {
        setTimeout(() => {
          queryClient.invalidateProjectStats();
        }, 1000);
      }
      // Prefetch 7-day data if currently on 30-day view  
      if (days === 30) {
        setTimeout(() => {
          queryClient.invalidateProjectStats();
        }, 1000);
      }
    }
  }, [projectId, queryClient, days]);

  const { data: stats, isLoading, error, refetch } = useProjectStats(projectId, days, {
    // Enhanced cache configuration for dashboard
    staleTime: 3 * 60 * 1000, // 3 minutes for dashboard data
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Move all useMemo hooks before early returns to fix React hooks rules
  const browserData = useMemo(() => {
    if (!stats?.browserDistribution) return [];
    const rawData = stats.browserDistribution.map(item => ({
      name: item.browser,
      value: item.count,
      percentage: item.percentage,
    }));
    
    return sampleAndAggregateData(filterLowValueItems(rawData));
  }, [stats?.browserDistribution]);

  const osData = useMemo(() => {
    if (!stats?.osDistribution) return [];
    const rawData = stats.osDistribution.map(item => ({
      name: item.os,
      value: item.count,
      percentage: item.percentage,
    }));
    
    return sampleAndAggregateData(filterLowValueItems(rawData));
  }, [stats?.osDistribution]);

  const statusData = useMemo(() => 
    Object.entries(stats?.errorsByStatus || {}).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: status === 'resolved' ? '#10B981' : status === 'investigating' ? '#F59E0B' : 
             status === 'ignored' ? '#6B7280' : '#EF4444',
    })), [stats?.errorsByStatus]
  );

  const topPages = useMemo(() => 
    stats?.topErrorPages?.slice(0, 5) || [], [stats?.topErrorPages]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            Failed to load analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to load analytics data. Please try refreshing.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="size-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into errors, user behavior, and system performance.
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 3 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Cards */}
      <KeyMetricsSection 
        uniqueUsers={stats.uniqueUsers || 0}
        averageSessionDuration={stats.averageSessionDuration || 0}
        errorRate={stats.errorRate || 0}
        totalErrors={stats.totalErrors || 0}
        errorsByStatus={stats.errorsByStatus}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Browser Distribution */}
        <LazyChartWrapper>
          <BrowserDistributionChart data={browserData} />
        </LazyChartWrapper>

        {/* OS Distribution */}
        <LazyChartWrapper>
          <OSDistributionChart data={osData} />
        </LazyChartWrapper>

        {/* Error Status Distribution */}
        <LazyChartWrapper>
          <ErrorStatusChart data={statusData} />
        </LazyChartWrapper>

        {/* Top Error Pages */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Error Pages</CardTitle>
            <CardDescription>
              Pages with the most errors in the selected time range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPages.length > 0 ? topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{page.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {page.count} errors ({page.percentage.toFixed(1)}% of total)
                    </p>
                  </div>
                  <Badge variant="outline">#{index + 1}</Badge>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No error page data available for this time range.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Errors */}
        <Card>
          <CardHeader>
            <CardTitle>Most Frequent Errors</CardTitle>
            <CardDescription>
              Common error messages and their occurrence count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topErrors?.slice(0, 5).map((error, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">#{index + 1}</span>
                    <Badge variant="destructive" className="text-xs">
                      {error.count}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {error.message}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Last seen: {new Date(error.lastSeen).toLocaleDateString()}
                  </div>
                  {index < 4 && <hr className="border-muted" />}
                </div>
              )) || (
                <div className="text-center py-4 text-muted-foreground">
                  No error data available.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}