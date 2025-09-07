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
    <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:bg-white/40 dark:hover:bg-gray-800/40">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-normal text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {project.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2 text-gray-600 dark:text-gray-400 font-light">
              <IconClock className="h-4 w-4" />
              Created {project.created_at.toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs px-2 py-1 bg-gray-200/50 dark:bg-gray-600/50 text-gray-700 dark:text-gray-300 border-0 font-light">
            ID: {project.id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Health Status - Using pre-calculated data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                project.status === 'critical' ? 'bg-red-500/10' :
                project.status === 'warning' ? 'bg-orange-500/10' :
                'bg-emerald-500/10'
              }`}>
                {project.status === 'critical' && (
                  <IconCircleX className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                {project.status === 'warning' && (
                  <IconAlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                )}
                {(project.status === 'active' || project.status === 'healthy') && (
                  <IconCircleCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <span className="text-lg font-normal capitalize text-gray-800 dark:text-gray-200">{project.status}</span>
            </div>
            <Badge 
              className={`text-xs px-2 py-1 border-0 font-light ${
                healthStatusColor === 'green' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              {project.errorRate || 0} err/day
            </Badge>
          </div>

          {/* Project Health Indicators - Using aggregated data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 dark:bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <IconAlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-light">Errors</span>
              </div>
              <span className="text-xl font-light text-gray-800 dark:text-gray-200">{project.totalErrors || 0}</span>
            </div>
            <div className="bg-white/20 dark:bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <IconUsers className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-light">Sessions</span>
              </div>
              <span className="text-xl font-light text-gray-800 dark:text-gray-200">{project.activeSessions || 0}</span>
            </div>
          </div>

          {/* Last Activity */}
          {project.lastActivity && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
              <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Last activity: {formatRelativeTime(project.lastActivity)}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <Link href={`/dashboard/projects/${project.id}/dashboard`}>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => apiClient.setProjectId(project.id)}
                className="font-normal text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
              >
                View Dashboard
                <IconArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}