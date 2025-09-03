'use client';

import { useProjects } from '@/lib/hooks/useReviData';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  IconFolderPlus,
  IconActivity,
  IconAlertTriangle,
  IconUsers,
  IconTrendingUp,
  IconClock
} from "@tabler/icons-react";
import Link from "next/link";
import { ProjectHealthCard } from './project-health-card';

export function ProjectsOverview() {
  const { data: projectsResponse, isLoading, error } = useProjects();
  
  const projects = projectsResponse?.projects || [];

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
                <Button size="lg">
                  <IconFolderPlus className="h-5 w-5 mr-2" />
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
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Projects</CardDescription>
            <CardTitle className="text-2xl">{projects.length}</CardTitle>
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
            <CardTitle className="text-2xl">--</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconAlertTriangle className="h-3 w-3" />
              <span>Across all projects</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Sessions</CardDescription>
            <CardTitle className="text-2xl">--</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconUsers className="h-3 w-3" />
              <span>Live monitoring</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Activity</CardDescription>
            <CardTitle className="text-2xl">--</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconClock className="h-3 w-3" />
              <span>Most recent</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Your Projects</h2>
          <Link href="/dashboard/projects/create">
            <Button variant="outline">
              <IconFolderPlus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectHealthCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}