'use client';

import { useProjectHealth } from '@/lib/hooks/useReviData';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ProjectHealthCardProps {
  project: {
    id: number;
    name: string;
    created_at: string | Date;
    updated_at: string | Date;
  };
}

export function ProjectHealthCard({ project }: ProjectHealthCardProps) {
  const { data: health, isLoading } = useProjectHealth(project.id);

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getHealthStatus = () => {
    if (!health) return { status: 'unknown', color: 'gray' };
    
    if (health.errorRate > 10) return { status: 'critical', color: 'red' };
    if (health.errorRate > 5) return { status: 'warning', color: 'orange' };
    if (health.hasRecentActivity) return { status: 'active', color: 'green' };
    return { status: 'healthy', color: 'green' };
  };

  const healthStatus = getHealthStatus();

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
              Created {(typeof project.created_at === 'string' ? new Date(project.created_at) : project.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            ID: {project.id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Health Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {healthStatus.status === 'critical' && (
                <IconCircleX className="h-4 w-4 text-red-500" />
              )}
              {healthStatus.status === 'warning' && (
                <IconAlertTriangle className="h-4 w-4 text-orange-500" />
              )}
              {(healthStatus.status === 'active' || healthStatus.status === 'healthy') && (
                <IconCircleCheck className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium capitalize">{healthStatus.status}</span>
            </div>
            <Badge 
              variant={healthStatus.color === 'green' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {health?.errorRate || 0} err/day
            </Badge>
          </div>

          {/* Project Health Indicators */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <IconAlertTriangle className="h-3 w-3" />
                  <span>Errors</span>
                </div>
                <span className="font-medium">{health?.totalErrors || 0}</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <IconUsers className="h-3 w-3" />
                  <span>Sessions</span>
                </div>
                <span className="font-medium">{health?.activeSessions || 0}</span>
              </div>
            </div>
          )}

          {/* Last Activity */}
          {health?.lastActivity && (
            <div className="text-xs text-muted-foreground">
              Last activity: {formatRelativeTime(typeof health.lastActivity === 'string' ? health.lastActivity : health.lastActivity.toISOString())}
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