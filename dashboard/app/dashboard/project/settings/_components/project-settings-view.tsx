'use client';

import { useState } from "react";
import { useProjects, useCreateProject } from "@/lib/hooks/useReviData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  IconKey, 
  IconSettings, 
  IconBell,
  IconUsers,
  IconCode,
  IconCopy,
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconRefresh,
  IconExternalLink
} from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function ProjectSettingsView() {
  const { data: projectsData, isLoading, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Project creation
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    
    createProject.mutate({ name: newProjectName.trim() }, {
      onSuccess: () => {
        setNewProjectName("");
        refetch();
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </CardHeader>
          <CardContent>
            <div className="h-32 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            Failed to load projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to load project data. Please try refreshing.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="size-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const projects = projectsData?.projects || [];
  const currentProject = selectedProject ? projects.find(p => p.id === selectedProject) : projects[0];

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSettings className="size-5" />
            Project Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="project-select">Select Project</Label>
              <Select 
                value={selectedProject?.toString() || projects[0]?.id?.toString() || ""} 
                onValueChange={(value) => setSelectedProject(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium">Create New Project</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Enter project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleCreateProject} 
                disabled={!newProjectName.trim() || createProject.isPending}
              >
                <IconPlus className="size-4 mr-2" />
                {createProject.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Settings Tabs */}
      {currentProject && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input 
                      id="project-name" 
                      value={currentProject.name} 
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-id">Project ID</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="project-id" 
                        value={currentProject.id.toString()} 
                        readOnly
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(currentProject.id.toString())}
                      >
                        <IconCopy className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="created-at">Created At</Label>
                  <Input 
                    id="created-at" 
                    value={new Date(currentProject.created_at).toLocaleDateString()} 
                    readOnly
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-destructive">Danger Zone</h4>
                  <div className="border border-destructive/20 rounded-lg p-4 space-y-3">
                    <div>
                      <h5 className="font-medium mb-1">Delete Project</h5>
                      <p className="text-sm text-muted-foreground mb-3">
                        Permanently delete this project and all associated data. This action cannot be undone.
                      </p>
                      <Button variant="destructive" size="sm">
                        <IconTrash className="size-4 mr-2" />
                        Delete Project
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconKey className="size-5" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Client API Key</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use this key in your client-side applications to send error data to Revi.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={currentProject.api_key} 
                      readOnly
                      type="password"
                      className="font-mono"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(currentProject.api_key)}
                    >
                      <IconCopy className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <IconRefresh className="size-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">SDK Integration</h4>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <IconCode className="size-4" />
                      JavaScript SDK
                    </h5>
                    <pre className="text-sm bg-background border rounded p-3 overflow-x-auto">
{`import { ReviMonitor } from 'revi-monitor';

const revi = new ReviMonitor({
  projectId: '${currentProject.id}',
  apiKey: '${currentProject.api_key}',
  environment: 'production'
});

// Initialize monitoring
revi.init();`}
                    </pre>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm">
                        <IconCopy className="size-4 mr-2" />
                        Copy Code
                      </Button>
                      <Button variant="outline" size="sm">
                        <IconExternalLink className="size-4 mr-2" />
                        View Docs
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Settings */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBell className="size-5" />
                  Alert Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Error Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new errors occur
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Daily Summary</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive daily reports of error activity
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Critical Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Immediate alerts for critical errors
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Alert Thresholds</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="error-threshold">Error Rate Threshold</Label>
                      <div className="flex gap-2 items-center">
                        <Input 
                          id="error-threshold" 
                          type="number" 
                          placeholder="10" 
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">errors/hour</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="session-threshold">Session Alert Threshold</Label>
                      <div className="flex gap-2 items-center">
                        <Input 
                          id="session-threshold" 
                          type="number" 
                          placeholder="100" 
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">sessions/day</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Notification Channels</h4>
                  
                  <div>
                    <Label htmlFor="email-notifications">Email Address</Label>
                    <Input 
                      id="email-notifications" 
                      type="email" 
                      placeholder="your-email@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                    <Input 
                      id="slack-webhook" 
                      type="url" 
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button>
                    Save Alert Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconUsers className="size-5" />
                  Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slack Integration */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <IconBell className="size-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Slack</h4>
                          <p className="text-sm text-muted-foreground">Error notifications</p>
                        </div>
                      </div>
                      <Badge variant="outline">Not Connected</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Connect Slack
                    </Button>
                  </Card>

                  {/* GitHub Integration */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <IconCode className="size-5 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">GitHub</h4>
                          <p className="text-sm text-muted-foreground">Issue tracking</p>
                        </div>
                      </div>
                      <Badge variant="outline">Not Connected</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Connect GitHub
                    </Button>
                  </Card>

                  {/* Jira Integration */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <IconSettings className="size-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Jira</h4>
                          <p className="text-sm text-muted-foreground">Project management</p>
                        </div>
                      </div>
                      <Badge variant="outline">Not Connected</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Connect Jira
                    </Button>
                  </Card>

                  {/* Webhook Integration */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <IconExternalLink className="size-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Webhooks</h4>
                          <p className="text-sm text-muted-foreground">Custom endpoints</p>
                        </div>
                      </div>
                      <Badge variant="outline">Available</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Configure Webhooks
                    </Button>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}