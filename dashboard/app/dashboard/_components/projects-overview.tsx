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
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg animate-pulse">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-32 bg-gray-200/50 dark:bg-gray-700/50" />
                <Skeleton className="h-4 w-24 bg-gray-200/50 dark:bg-gray-700/50" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full bg-gray-200/50 dark:bg-gray-700/50" />
                  <Skeleton className="h-4 w-3/4 bg-gray-200/50 dark:bg-gray-700/50" />
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
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-normal">
            <div className="p-2 rounded-lg bg-red-500/10">
              <IconAlertTriangle className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-gray-800 dark:text-gray-200">Error Loading Projects</span>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
            Failed to load projects. Please try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // No projects state
  if (projects.length === 0) {
    return (
      <div className="space-y-8">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <div className="mx-auto flex max-w-[480px] flex-col items-center justify-center text-center">
              <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8">
                <IconFolderPlus className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-light mb-3 text-gray-800 dark:text-gray-200">Welcome to Revi!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg font-light leading-relaxed">
                Get started by creating your first monitoring project. You&apos;ll receive an API key to integrate error tracking into your application.
              </p>
              <Link href="/dashboard/projects/create">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal px-8 py-3" aria-label="Create your first monitoring project">
                  <IconFolderPlus className="h-5 w-5 mr-3" aria-hidden="true" />
                  Create Your First Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-blue-500/10 w-fit mb-3">
                <IconActivity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl font-normal text-gray-800 dark:text-gray-200">Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 font-light">
                Track errors and user sessions as they happen in your applications.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 w-fit mb-3">
                <IconUsers className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-xl font-normal text-gray-800 dark:text-gray-200">Session Replay</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 font-light">
                See exactly what users were doing when errors occurred.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="p-3 rounded-lg bg-purple-500/10 w-fit mb-3">
                <IconTrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-xl font-normal text-gray-800 dark:text-gray-200">Performance Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 font-light">
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
    <div className="space-y-8">
      {/* Quick Stats - Now showing real data from aggregated API */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Total Projects</CardDescription>
            <CardTitle className="text-3xl font-light text-gray-800 dark:text-gray-200">{summary?.totalProjects || projects.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <IconActivity className="h-4 w-4 text-emerald-500" />
              <span className="font-light">Active monitoring</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Total Errors</CardDescription>
            <CardTitle className="text-3xl font-light text-gray-800 dark:text-gray-200">{summary?.totalErrors?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <IconAlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-light">Last 7 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Active Sessions</CardDescription>
            <CardTitle className="text-3xl font-light text-gray-800 dark:text-gray-200">{summary?.totalActiveSessions?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <IconUsers className="h-4 w-4 text-blue-500" />
              <span className="font-light">Last 7 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600 dark:text-gray-400 font-light">Unique Users</CardDescription>
            <CardTitle className="text-3xl font-light text-gray-800 dark:text-gray-200">{summary?.totalUniqueUsers?.toLocaleString() || '0'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <IconUsers className="h-4 w-4 text-purple-500" />
              <span className="font-light">Last 7 days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Trend Insight - Only show if there are errors */}
      {summary?.totalErrors && summary.totalErrors > 0 && (
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-normal">
              <div className="p-2 rounded-lg bg-red-500/10">
                <IconTrendingUp className="size-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-gray-800 dark:text-gray-200">Recent Error Activity</span>
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
              Error trend across all projects in the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="text-gray-600 dark:text-gray-400 font-light">
                Total errors: <span className="font-normal text-gray-800 dark:text-gray-200">{summary.totalErrors}</span>
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-light">
                Avg. rate: <span className="font-normal text-gray-800 dark:text-gray-200">{summary.avgErrorRate}/day</span>
              </div>
              {summary.lastActivity && (
                <div className="text-gray-600 dark:text-gray-400 font-light">
                  Last error: <span className="font-normal text-gray-800 dark:text-gray-200">
                    {formatRelativeTime(summary.lastActivity)}
                  </span>
                </div>
              )}
            </div>
            {topErrors.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-light mb-4">Most common errors:</p>
                <div className="space-y-3">
                  {topErrors.slice(0, 3).map((error: TopError, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-white/20 dark:bg-gray-700/30 rounded-lg p-3">
                      <span className="truncate max-w-[250px] font-light text-gray-700 dark:text-gray-300" title={error?.message || 'Unknown error'}>
                        {error?.message || 'Unknown error'}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs px-2 py-1 bg-gray-200/50 dark:bg-gray-600/50 text-gray-700 dark:text-gray-300 border-0 font-light">
                          {error?.affectedProjects || 0} {(error?.affectedProjects || 0) === 1 ? 'project' : 'projects'}
                        </Badge>
                        <span className="text-gray-600 dark:text-gray-400 font-light">
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200">Your Projects</h2>
          <Link href="/dashboard/projects/create">
            <Button 
              variant="outline" 
              className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors font-normal"
              aria-label="Create new monitoring project"
            >
              <IconFolderPlus className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-gray-700 dark:text-gray-300">Create Project</span>
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project: ProjectHealthSummary) => (
            <OptimizedProjectHealthCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}