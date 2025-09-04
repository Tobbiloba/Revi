'use client';

import { useProjectsOverviewOptimized } from '@/lib/hooks/useReviData';
import type { ProjectHealthSummary } from '@/lib/revi-api';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  IconFolderPlus,
  IconActivity,
  IconAlertTriangle,
  IconUsers,
  IconTrendingUp
} from "@tabler/icons-react";
import Link from "next/link";
import { OptimizedProjectHealthCard } from './optimized-project-health-card';

// Type definitions for error objects
interface TopError {
  message?: string;
  count?: number;
  affectedProjects?: number;
}

// Remove custom Project interface and use ProjectHealthSummary from the API

// Utility function for formatting relative time - moved outside component for performance
const formatRelativeTime = (timestamp: Date | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export function ProjectsOverview() {
  // PERFORMANCE OPTIMIZATION: Single API call instead of multiple
  const { data: overviewData, isLoading, error } = useProjectsOverviewOptimized(7);
  
  const projects = overviewData?.projects || [];
  const summary = overviewData?.summary;
  const topErrors = overviewData?.topErrors || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Projects</CardTitle>
          <CardDescription>
            Failed to load projects. Please try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // No projects state
  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
                <IconFolderPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to Revi!</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first monitoring project. You&apos;ll receive an API key to integrate error tracking into your application.
              </p>
              <Link href="/dashboard/projects/create">
                <Button size="lg" aria-label="Create your first monitoring project">
                  <IconFolderPlus className="h-5 w-5 mr-2" aria-hidden="true" />
                  Create Your First Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800">
            <CardHeader>
              <IconActivity className="h-8 w-8 text-blue-500 mb-2" />
              <CardTitle className="text-blue-800 dark:text-blue-200">Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Track errors and user sessions as they happen in your applications.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-green-50/50 border-green-200 dark:bg-green-950/50 dark:border-green-800">
            <CardHeader>
              <IconUsers className="h-8 w-8 text-green-500 mb-2" />
              <CardTitle className="text-green-800 dark:text-green-200">Session Replay</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700 dark:text-green-300">
                See exactly what users were doing when errors occurred.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800">
            <CardHeader>
              <IconTrendingUp className="h-8 w-8 text-purple-500 mb-2" />
              <CardTitle className="text-purple-800 dark:text-purple-200">Performance Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Monitor application performance and identify bottlenecks.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Projects overview
  return (
    <div className="space-y-6">
      {/* Quick Stats - Now showing real data from aggregated API */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Projects</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalProjects || projects.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconActivity className="h-3 w-3" />
              <span>Active monitoring</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Errors</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalErrors?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconAlertTriangle className="h-3 w-3" />
              <span>Last 7 days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Sessions</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalActiveSessions?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconUsers className="h-3 w-3" />
              <span>Last 7 days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique Users</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalUniqueUsers?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconUsers className="h-3 w-3" />
              <span>Last 7 days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Trend Insight - Only show if there are errors */}
      {summary?.totalErrors && summary.totalErrors > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <IconTrendingUp className="h-5 w-5" />
              Recent Error Activity
            </CardTitle>
            <CardDescription>
              Error trend across all projects in the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Total errors: <span className="font-medium text-foreground">{summary.totalErrors}</span>
              </div>
              <div className="text-muted-foreground">
                Avg. rate: <span className="font-medium text-foreground">{summary.avgErrorRate}/day</span>
              </div>
              {summary.lastActivity && (
                <div className="text-muted-foreground">
                  Last error: <span className="font-medium text-foreground">
                    {formatRelativeTime(summary.lastActivity)}
                  </span>
                </div>
              )}
            </div>
            {topErrors.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Most common errors:</p>
                <div className="space-y-1">
                  {topErrors.slice(0, 3).map((error: TopError, index: number) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[200px]" title={error?.message || 'Unknown error'}>
                        {error?.message || 'Unknown error'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {error?.affectedProjects || 0} {(error?.affectedProjects || 0) === 1 ? 'project' : 'projects'}
                        </Badge>
                        <span className="text-muted-foreground">
                          {error?.count || 0}×
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Your Projects</h2>
          <Link href="/dashboard/projects/create">
            <Button variant="outline" aria-label="Create new monitoring project">
              <IconFolderPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Create Project
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: ProjectHealthSummary) => (
            <OptimizedProjectHealthCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}