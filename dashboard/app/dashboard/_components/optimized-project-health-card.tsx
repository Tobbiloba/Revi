'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconAlertTriangle, 
  IconUsers,
  IconClock,
  IconArrowRight,
  IconCircleCheck,
  IconCircleX
} from "@tabler/icons-react";
import Link from "next/link";
import apiClient from '@/lib/revi-api';
import type { ProjectHealthSummary } from '@/lib/revi-api';

interface OptimizedProjectHealthCardProps {
  project: ProjectHealthSummary;
}

export function OptimizedProjectHealthCard({ project }: OptimizedProjectHealthCardProps) {
  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'red';
      case 'warning': return 'orange';
      case 'active':
      case 'healthy': return 'green';
      default: return 'gray';
    }
  };

  const healthStatusColor = getHealthStatusColor(project.status);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg group-hover:text-lime-600 transition-colors">
              {project.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <IconClock className="h-3 w-3" />
              Created {project.created_at.toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            ID: {project.id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Health Status - Using pre-calculated data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {project.status === 'critical' && (
                <IconCircleX className="h-4 w-4 text-red-500" />
              )}
              {project.status === 'warning' && (
                <IconAlertTriangle className="h-4 w-4 text-orange-500" />
              )}
              {(project.status === 'active' || project.status === 'healthy') && (
                <IconCircleCheck className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium capitalize">{project.status}</span>
            </div>
            <Badge 
              variant={healthStatusColor === 'green' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {project.errorRate || 0} err/day
            </Badge>
          </div>

          {/* Project Health Indicators - Using aggregated data */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-muted-foreground">
                <IconAlertTriangle className="h-3 w-3" />
                <span>Errors</span>
              </div>
              <span className="font-medium">{project.totalErrors || 0}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-muted-foreground">
                <IconUsers className="h-3 w-3" />
                <span>Sessions</span>
              </div>
              <span className="font-medium">{project.activeSessions || 0}</span>
            </div>
          </div>

          {/* Last Activity */}
          {project.lastActivity && (
            <div className="text-xs text-muted-foreground">
              Last activity: {formatRelativeTime(project.lastActivity)}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            <Link href={`/dashboard/projects/${project.id}/dashboard`}>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => apiClient.setProjectId(project.id)}
                className="group-hover:bg-lime-100 dark:group-hover:bg-lime-900/20"
              >
                View Dashboard
                <IconArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}