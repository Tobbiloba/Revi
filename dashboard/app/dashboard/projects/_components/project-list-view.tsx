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
          <Skeleton className="h-8 w-32 bg-gray-200/50 dark:bg-gray-700/50" />
          <Skeleton className="h-10 w-32 bg-gray-200/50 dark:bg-gray-700/50" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg animate-pulse">
              <CardHeader>
                <Skeleton className="h-6 w-48 bg-gray-200/50 dark:bg-gray-700/50" />
                <Skeleton className="h-4 w-32 bg-gray-200/50 dark:bg-gray-700/50" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full bg-gray-200/50 dark:bg-gray-700/50" />
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
          <CardTitle className="text-red-600 dark:text-red-400 font-normal">Error Loading Projects</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
            Failed to load projects. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-normal">
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
          <h2 className="text-lg font-normal text-gray-800 dark:text-gray-200">Your Projects</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal">
              <IconPlus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-0 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-200 font-normal">Create New Project</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-light">
                Create a new monitoring project to get an API key for integrating the Revi SDK.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-gray-700 dark:text-gray-300 font-normal">Project Name</Label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Awesome App"
                  disabled={createProjectMutation.isPending}
                  autoFocus
                  className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 font-light"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createProjectMutation.isPending}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal">
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="p-3 rounded-lg bg-emerald-500/10 w-fit mb-4">
                <IconKey className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mt-4 text-lg font-normal text-gray-800 dark:text-gray-200">No projects yet</h3>
              <p className="mb-4 mt-2 text-sm text-gray-600 dark:text-gray-400 font-light">
                Create your first project to start monitoring errors in your applications.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal">
                <IconPlus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="relative bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl font-normal text-gray-800 dark:text-gray-200">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2 text-gray-600 dark:text-gray-400 font-light">
                      <IconCalendar className="h-4 w-4" />
                      Created {formatDate(project.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">ID: {project.id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={project.api_key}
                        readOnly
                        className="font-mono text-sm bg-white/20 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700"
                        type="password"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyApiKey(project.api_key, project.name)}
                        className="flex-shrink-0 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                      >
                        {copiedApiKey === project.api_key ? (
                          <IconCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <IconCopy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-light mt-1">
                      Use this API key to configure the Revi SDK in your application.
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-light">
                        Last updated: {formatDate(project.updated_at)}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <Button size="sm" variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                            View Details
                          </Button>
                        </Link>
                        <Link href={`/dashboard/errors?project=${project.id}`}>
                          <Button size="sm" variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-normal">
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