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
          <Card className="animate-pulse bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="h-6 bg-gray-200/50 dark:bg-gray-700/50 rounded w-32 mb-2" />
              <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200/50 dark:bg-gray-700/50 rounded" />
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
  <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <IconBrowser className="size-5 text-blue-600 dark:text-blue-400" />
        </div>
        Browser Distribution
      </CardTitle>
      <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
        Sessions by browser type ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} total)
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
  <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
        <div className="p-2 rounded-lg bg-green-500/10">
          <IconDeviceMobile className="size-5 text-green-600 dark:text-green-400" />
        </div>
        Operating System
      </CardTitle>
      <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
        Sessions by operating system ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} total)
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

interface DeviceTypeDistributionChartProps {
  data: ChartData[];
}

const DeviceTypeDistributionChart = React.memo(({ data }: DeviceTypeDistributionChartProps) => (
  <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <IconDeviceMobile className="size-5 text-purple-600 dark:text-purple-400" />
        </div>
        Device Type
      </CardTitle>
      <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
        Sessions by device type ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} total)
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
                <Cell key={`device-cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
));
DeviceTypeDistributionChart.displayName = 'DeviceTypeDistributionChart';

interface ScreenResolutionChartProps {
  data: ChartData[];
}

const ScreenResolutionChart = React.memo(({ data }: ScreenResolutionChartProps) => (
  <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <IconDeviceMobile className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        Screen Resolution
      </CardTitle>
      <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
        Top screen resolutions ({data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) : 0} sessions)
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {data.length > 0 ? data.slice(0, 6).map((resolution, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white/20 dark:bg-gray-700/20 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="font-normal text-sm text-gray-800 dark:text-gray-200">{resolution.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
                {resolution.value} sessions ({resolution.percentage?.toFixed(1)}%)
              </p>
            </div>
            <Badge variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">#{index + 1}</Badge>
          </div>
        )) : (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
            No resolution data available.
          </div>
        )}
      </div>
    </CardContent>
  </Card>
));
ScreenResolutionChart.displayName = 'ScreenResolutionChart';

interface ErrorStatusChartProps {
  data: ChartData[];
}

const ErrorStatusChart = React.memo(({ data }: ErrorStatusChartProps) => (
  <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-normal">
        <div className="p-2 rounded-lg bg-red-500/10">
          <IconAlertCircle className="size-5 text-red-600 dark:text-red-400" />
        </div>
        Error Status
      </CardTitle>
      <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
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
    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Unique Users</CardDescription>
        <CardTitle className="text-2xl font-light text-gray-800 dark:text-gray-200">
          {uniqueUsers?.toLocaleString() || 0}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
          <IconUsers className="size-4" />
          <span>Active users tracked</span>
        </div>
      </CardContent>
    </Card>

    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Avg. Session Duration</CardDescription>
        <CardTitle className="text-2xl font-light text-gray-800 dark:text-gray-200">
          {averageSessionDuration ? 
            `${Math.round(averageSessionDuration / 60)}m` : '0m'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
          <IconClock className="size-4" />
          <span>Average user session</span>
        </div>
      </CardContent>
    </Card>

    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Error Rate</CardDescription>
        <CardTitle className="text-2xl font-light text-gray-800 dark:text-gray-200">
          {(errorRate || 0).toFixed(1)}/day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
          <IconAlertCircle className="size-4" />
          <span>Daily error occurrence</span>
        </div>
      </CardContent>
    </Card>

    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Resolution Rate</CardDescription>
        <CardTitle className="text-2xl font-light text-gray-800 dark:text-gray-200">
          {totalErrors > 0 ? 
            Math.round((errorsByStatus?.resolved || 0) / totalErrors * 100) : 0}%
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
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

  const deviceTypeData = useMemo(() => {
    if (!stats?.deviceTypeDistribution) return [];
    const rawData = stats.deviceTypeDistribution.map(item => ({
      name: item.deviceType,
      value: item.count,
      percentage: item.percentage,
    }));
    
    return sampleAndAggregateData(filterLowValueItems(rawData));
  }, [stats?.deviceTypeDistribution]);

  const screenResolutionData = useMemo(() => {
    if (!stats?.screenResolutionDistribution) return [];
    const rawData = stats.screenResolutionDistribution.map(item => ({
      name: item.resolution,
      value: item.count,
      percentage: item.percentage,
    }));
    
    return sampleAndAggregateData(filterLowValueItems(rawData));
  }, [stats?.screenResolutionDistribution]);

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
          <Card key={i} className="animate-pulse bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200/50 dark:bg-gray-700/50 rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-gray-200/50 dark:bg-gray-700/50 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 font-normal flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            Failed to load analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 font-light mb-4">
            Unable to load analytics data. Please try refreshing.
          </p>
          <Button onClick={() => refetch()} variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
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
          <h2 className="text-2xl font-light tracking-tight text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Comprehensive insights into errors, user behavior, and system performance.
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Browser Distribution */}
        <LazyChartWrapper>
          <BrowserDistributionChart data={browserData} />
        </LazyChartWrapper>

        {/* OS Distribution */}
        <LazyChartWrapper>
          <OSDistributionChart data={osData} />
        </LazyChartWrapper>

        {/* Device Type Distribution */}
        <LazyChartWrapper>
          <DeviceTypeDistributionChart data={deviceTypeData} />
        </LazyChartWrapper>

        {/* Error Status Distribution */}
        <LazyChartWrapper>
          <ErrorStatusChart data={statusData} />
        </LazyChartWrapper>

        {/* Screen Resolution Distribution */}
        <LazyChartWrapper className="xl:col-span-2">
          <ScreenResolutionChart data={screenResolutionData} />
        </LazyChartWrapper>

        {/* Top Error Pages */}
        <Card className="xl:col-span-2 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-800 dark:text-gray-200 font-normal">Top Error Pages</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
              Pages with the most errors in the selected time range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPages.length > 0 ? topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/20 dark:bg-gray-700/20 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-normal text-sm truncate text-gray-800 dark:text-gray-200">{page.url}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
                      {page.count} errors ({page.percentage.toFixed(1)}% of total)
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">#{index + 1}</Badge>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
                  No error page data available for this time range.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Errors */}
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-800 dark:text-gray-200 font-normal">Most Frequent Errors</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
              Common error messages and their occurrence count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topErrors?.slice(0, 5).map((error, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-normal text-gray-700 dark:text-gray-300">#{index + 1}</span>
                    <Badge variant="destructive" className="text-xs border-0 font-light">
                      {error.count}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light line-clamp-2">
                    {error.message}
                  </p>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-light">
                    Last seen: {new Date(error.lastSeen).toLocaleDateString()}
                  </div>
                  {index < 4 && <hr className="border-gray-200/50 dark:border-gray-700/50" />}
                </div>
              )) || (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400 font-light">
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