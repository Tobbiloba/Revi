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
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800 backdrop-blur-sm shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
              <IconRocket className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-green-800 dark:text-green-200 font-normal">
              Project Created Successfully!
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300 font-light">
              Your new monitoring project is ready to use
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-normal">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <IconKey className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-gray-800 dark:text-gray-200">Project Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">Project Name</Label>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-light text-gray-800 dark:text-gray-200">{createdProject.name}</span>
                <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">ID: {createdProject.id}</Badge>
              </div>
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-light mt-1">{description}</p>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">API Key</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-light mb-2">
                Use this key to configure the Revi SDK in your application
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={createdProject.api_key}
                  readOnly
                  className="font-mono text-sm bg-white/20 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700"
                  type="password"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyApiKey}
                  className="flex-shrink-0 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  {copiedApiKey ? (
                    <IconCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <IconCopy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={goToProject} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal">
                <IconRocket className="h-4 w-4 mr-2" />
                Go to Project Dashboard
              </Button>
              <Button onClick={goToDashboard} variant="outline" className="flex-1 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 text-lg font-normal">
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-blue-700 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
              </div>
              <div>
                <p className="font-normal">Install the Revi SDK</p>
                <p className="text-sm font-light">Add error monitoring to your application</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">2</span>
              </div>
              <div>
                <p className="font-normal">Configure with your API key</p>
                <p className="text-sm font-light">Use the key above to connect your app</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">3</span>
              </div>
              <div>
                <p className="font-normal">Start monitoring</p>
                <p className="text-sm font-light">View errors and session replays in your dashboard</p>
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
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700/20">
                <IconArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
            </Link>
            <div>
              <CardTitle className="text-gray-800 dark:text-gray-200 font-normal">Project Information</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 font-light">
                Provide basic information about your monitoring project
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-normal">
                Project Name <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome App"
                disabled={createProjectMutation.isPending}
                autoFocus
                maxLength={50}
                className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 font-light"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
                Choose a descriptive name for your project (max 50 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300 font-normal">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of what this project monitors..."
                disabled={createProjectMutation.isPending}
                maxLength={200}
                rows={3}
                className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 font-light"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
                Optional description to help identify this project (max 200 characters)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <Link href="/dashboard/projects">
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={createProjectMutation.isPending}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal"
                >
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={createProjectMutation.isPending || !name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal"
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-slate-200 text-lg font-normal">
            What happens next?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-600 dark:text-slate-400">
          <p className="text-sm font-light">
            After creating your project, you&apos;ll get an API key to integrate the Revi SDK into your application. 
            This enables real-time error monitoring, session replay, and performance tracking.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">Error Monitoring</Badge>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">Session Replay</Badge>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">Performance Tracking</Badge>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">Real-time Alerts</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}