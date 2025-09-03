'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/lib/hooks/useReviData';
import { useProjectContext } from '@/lib/contexts/ProjectContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconArrowLeft, IconKey, IconRocket, IconCopy, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import Link from "next/link";

export function CreateProjectForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdProject, setCreatedProject] = useState<{id: number; name: string; api_key: string} | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  
  const router = useRouter();
  const { setCurrentProjectId } = useProjectContext();
  const createProjectMutation = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const result = await createProjectMutation.mutateAsync({
        name: name.trim()
      });
      
      setCreatedProject(result.project);
      
      // Auto-select the new project
      setCurrentProjectId(result.project.id);
      
      toast.success(`Project "${result.project.name}" created successfully!`);
    } catch (error) {
      toast.error('Failed to create project');
      console.error('Project creation failed:', error);
    }
  };

  const copyApiKey = async () => {
    if (!createdProject?.api_key) return;
    
    try {
      await navigator.clipboard.writeText(createdProject.api_key);
      setCopiedApiKey(true);
      toast.success('API key copied to clipboard');
      
      setTimeout(() => setCopiedApiKey(false), 2000);
    } catch {
      toast.error('Failed to copy API key');
    }
  };

  const goToProject = () => {
    if (createdProject) {
      router.push(`/dashboard/projects/${createdProject.id}/dashboard`);
    }
  };

  const goToDashboard = () => {
    router.push('/dashboard');
  };

  // Success state - show created project details
  if (createdProject) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
              <IconRocket className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-green-800 dark:text-green-200">
              Project Created Successfully!
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Your new monitoring project is ready to use
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconKey className="h-5 w-5" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Project Name</Label>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-semibold">{createdProject.name}</span>
                <Badge variant="secondary">ID: {createdProject.id}</Badge>
              </div>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium">API Key</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Use this key to configure the Revi SDK in your application
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={createdProject.api_key}
                  readOnly
                  className="font-mono text-sm"
                  type="password"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyApiKey}
                  className="flex-shrink-0"
                >
                  {copiedApiKey ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={goToProject} className="flex-1">
                <IconRocket className="h-4 w-4 mr-2" />
                Go to Project Dashboard
              </Button>
              <Button onClick={goToDashboard} variant="outline" className="flex-1">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 text-lg">
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-blue-700 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
              </div>
              <div>
                <p className="font-medium">Install the Revi SDK</p>
                <p className="text-sm">Add error monitoring to your application</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">2</span>
              </div>
              <div>
                <p className="font-medium">Configure with your API key</p>
                <p className="text-sm">Use the key above to connect your app</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">3</span>
              </div>
              <div>
                <p className="font-medium">Start monitoring</p>
                <p className="text-sm">View errors and session replays in your dashboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="sm">
                <IconArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                Provide basic information about your monitoring project
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome App"
                disabled={createProjectMutation.isPending}
                autoFocus
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Choose a descriptive name for your project (max 50 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of what this project monitors..."
                disabled={createProjectMutation.isPending}
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional description to help identify this project (max 200 characters)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Link href="/dashboard/projects">
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={createProjectMutation.isPending}
                >
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={createProjectMutation.isPending || !name.trim()}
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-950/50 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-slate-200 text-lg">
            What happens next?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-600 dark:text-slate-400">
          <p className="text-sm">
            After creating your project, you&apos;ll get an API key to integrate the Revi SDK into your application. 
            This enables real-time error monitoring, session replay, and performance tracking.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Error Monitoring</Badge>
            <Badge variant="secondary">Session Replay</Badge>
            <Badge variant="secondary">Performance Tracking</Badge>
            <Badge variant="secondary">Real-time Alerts</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}