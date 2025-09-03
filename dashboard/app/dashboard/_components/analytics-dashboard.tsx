'use client';

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

import { useProjectStats } from "@/lib/hooks/useReviData";
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

interface AnalyticsDashboardProps {
  projectId?: number;
}

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps = {}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

  // Removed useEffect - projectId is now set at page level to prevent race conditions

  const { data: stats, isLoading, error, refetch } = useProjectStats(projectId, days);

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

  const browserData = stats.browserDistribution?.map(item => ({
    name: item.browser,
    value: item.count,
    percentage: item.percentage,
  })) || [];

  const osData = stats.osDistribution?.map(item => ({
    name: item.os,
    value: item.count,
    percentage: item.percentage,
  })) || [];

  const statusData = Object.entries(stats.errorsByStatus || {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: status === 'resolved' ? '#10B981' : status === 'investigating' ? '#F59E0B' : 
           status === 'ignored' ? '#6B7280' : '#EF4444',
  }));

  const topPages = stats.topErrorPages?.slice(0, 5) || [];

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Unique Users</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {stats.uniqueUsers?.toLocaleString() || 0}
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
              {stats.averageSessionDuration ? 
                `${Math.round(stats.averageSessionDuration / 60)}m` : '0m'}
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
              {(stats.errorRate || 0).toFixed(1)}/day
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
              {stats.totalErrors > 0 ? 
                Math.round((stats.errorsByStatus?.resolved || 0) / stats.totalErrors * 100) : 0}%
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Browser Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBrowser className="size-5" />
              Browser Distribution
            </CardTitle>
            <CardDescription>
              Errors by browser type ({browserData.length > 0 ? browserData.reduce((sum, item) => sum + item.value, 0) : 0} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={browserData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  >
                    {browserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* OS Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconDeviceMobile className="size-5" />
              Operating System
            </CardTitle>
            <CardDescription>
              Errors by operating system ({osData.length > 0 ? osData.reduce((sum, item) => sum + item.value, 0) : 0} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={osData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  >
                    {osData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Error Status Distribution */}
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
                <BarChart data={statusData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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