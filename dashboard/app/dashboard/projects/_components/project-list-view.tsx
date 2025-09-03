'use client';

import { useState } from 'react';
import { useProjects, useCreateProject } from '@/lib/hooks/useReviData';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPlus, IconKey, IconCalendar, IconCopy, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import Link from "next/link";

export function ProjectListView() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);

  const { data: projectsResponse, isLoading, error, refetch } = useProjects();
  const createProjectMutation = useCreateProject();

  const projects = projectsResponse?.projects || [];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const result = await createProjectMutation.mutateAsync({
        name: newProjectName.trim()
      });
      
      toast.success(`Project "${result.project.name}" created successfully!`);
      setNewProjectName('');
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error('Failed to create project');
      console.error('Project creation failed:', error);
    }
  };

  const copyApiKey = async (apiKey: string, projectName: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedApiKey(apiKey);
      toast.success(`API key for "${projectName}" copied to clipboard`);
      
      // Clear copied state after 2 seconds
      setTimeout(() => setCopiedApiKey(null), 2000);
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
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
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
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Your Projects</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Create a new monitoring project to get an API key for integrating the Revi SDK.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Awesome App"
                  disabled={createProjectMutation.isPending}
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createProjectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <IconKey className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                Create your first project to start monitoring errors in your applications.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <IconCalendar className="h-4 w-4" />
                      Created {formatDate(project.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">ID: {project.id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={project.api_key}
                        readOnly
                        className="font-mono text-sm"
                        type="password"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyApiKey(project.api_key, project.name)}
                        className="flex-shrink-0"
                      >
                        {copiedApiKey === project.api_key ? (
                          <IconCheck className="h-4 w-4" />
                        ) : (
                          <IconCopy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this API key to configure the Revi SDK in your application.
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Last updated: {formatDate(project.updated_at)}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </Link>
                        <Link href={`/dashboard/errors?project=${project.id}`}>
                          <Button size="sm" variant="outline">
                            View Errors
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}