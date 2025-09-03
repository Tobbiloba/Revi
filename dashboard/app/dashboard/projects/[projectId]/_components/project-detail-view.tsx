'use client';

import { useProject, useProjectStats } from "@/lib/hooks/useReviData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  IconArrowLeft, 
  IconKey, 
  IconCopy, 
  IconCheck,
  IconCalendar,
  IconAlertCircle,
  IconActivity,
  IconTrendingUp,
  IconUsers
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface ProjectDetailViewProps {
  projectId: number;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: stats, isLoading: statsLoading, error: statsError } = useProjectStats(projectId);

  const copyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedApiKey(true);
      toast.success('API key copied to clipboard');
      
      setTimeout(() => setCopiedApiKey(false), 2000);
    } catch {
      toast.error('Failed to copy API key');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-2" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="sm">
            <IconArrowLeft className="size-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The requested project could not be found or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard/projects">
              <Button variant="outline">Return to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm">
              <IconArrowLeft className="size-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {project.project?.name || `Project ${projectId}`}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <IconCalendar className="size-4" />
              Created {project.project?.created_at ? formatDate(project.project.created_at) : 'Unknown'}
            </p>
          </div>
        </div>
        <Badge variant="secondary">ID: {project.project?.id || projectId}</Badge>
      </div>

      {/* Project Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconKey className="size-5" />
            Project Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Project Name</Label>
              <Input value={project.project?.name || ''} readOnly className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Project ID</Label>
              <Input value={(project.project?.id || projectId).toString()} readOnly className="mt-1" />
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">API Key</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={project.project?.api_key || ''}
                readOnly
                className="font-mono text-sm"
                type="password"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyApiKey(project.project?.api_key || '')}
                className="flex-shrink-0"
              >
                {copiedApiKey ? (
                  <IconCheck className="size-4" />
                ) : (
                  <IconCopy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use this API key to configure the Revi SDK in your application.
            </p>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">SDK Integration Example</h4>
            <div className="bg-muted p-3 rounded text-sm font-mono">
              {`import { Monitor } from 'revi-monitor';

const revi = new Monitor({
  apiKey: '${project.project?.api_key}',
  environment: 'production'
});`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <IconAlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalErrors || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <IconTrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (stats?.errorRate || 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Errors per day
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <IconActivity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.activeSessions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <IconUsers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.uniqueUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Errors */}
      {stats && stats.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topErrors.slice(0, 5).map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{error.message}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {formatDate(error.lastSeen)}
                    </p>
                  </div>
                  <Badge variant="destructive">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/errors?project=${project.project?.id || projectId}`}>
              <Button variant="outline" size="sm">
                <IconAlertCircle className="size-4 mr-2" />
                View All Errors
              </Button>
            </Link>
            <Link href={`/dashboard/sessions?project=${project.project?.id || projectId}`}>
              <Button variant="outline" size="sm">
                <IconActivity className="size-4 mr-2" />
                View Sessions
              </Button>
            </Link>
            <Button variant="outline" size="sm" disabled>
              <IconKey className="size-4 mr-2" />
              Regenerate API Key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}