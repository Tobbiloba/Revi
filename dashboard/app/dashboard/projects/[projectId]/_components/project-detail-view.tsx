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
import { CodeBlock } from "@/components/ui/code-block";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface ProjectDetailViewProps {
  projectId: number;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: stats, isLoading: statsLoading } = useProjectStats(projectId);

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
          <div className="h-8 bg-gray-200/50 dark:bg-gray-700/50 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-48" />
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700/20">
            <IconArrowLeft className="size-4 mr-2 text-gray-600 dark:text-gray-400" />
            Back to Projects
          </Button>
        </Link>
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 font-normal">Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 font-light mb-4">
              The requested project could not be found or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard/projects">
              <Button variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal">Return to Projects</Button>
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
            <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700/20">
              <IconArrowLeft className="size-4 mr-2 text-gray-600 dark:text-gray-400" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
              {project.project?.name || `Project ${projectId}`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 font-light flex items-center gap-2">
              <IconCalendar className="size-4" />
              Created {project.project?.created_at ? formatDate(project.project.created_at) : 'Unknown'}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">ID: {project.project?.id || projectId}</Badge>
      </div>

      {/* Project Configuration */}
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-normal">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <IconKey className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-gray-800 dark:text-gray-200">Project Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">Project Name</Label>
              <Input value={project.project?.name || ''} readOnly className="mt-1 bg-white/20 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700" />
            </div>
            <div>
              <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">Project ID</Label>
              <Input value={(project.project?.id || projectId).toString()} readOnly className="mt-1 bg-white/20 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700" />
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-normal text-gray-700 dark:text-gray-300">API Key</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={project.project?.api_key || ''}
                readOnly
                className="font-mono text-sm bg-white/20 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700"
                type="password"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyApiKey(project.project?.api_key || '')}
                className="flex-shrink-0 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
              >
                {copiedApiKey ? (
                  <IconCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <IconCopy className="size-4 text-gray-600 dark:text-gray-400" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-light mt-1">
              Use this API key to configure the Revi SDK in your application.
            </p>
          </div>


        </CardContent>
      </Card>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-normal text-gray-700 dark:text-gray-300">Total Errors</CardTitle>
            <IconAlertCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light text-gray-800 dark:text-gray-200">
              {statsLoading ? '...' : stats?.totalErrors || 0}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
              Last 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-normal text-gray-700 dark:text-gray-300">Error Rate</CardTitle>
            <IconTrendingUp className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light text-gray-800 dark:text-gray-200">
              {statsLoading ? '...' : (stats?.errorRate || 0).toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
              Errors per day
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-normal text-gray-700 dark:text-gray-300">Active Sessions</CardTitle>
            <IconActivity className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light text-gray-800 dark:text-gray-200">
              {statsLoading ? '...' : stats?.activeSessions || 0}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
              Last 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-normal text-gray-700 dark:text-gray-300">Unique Users</CardTitle>
            <IconUsers className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light text-gray-800 dark:text-gray-200">
              {statsLoading ? '...' : stats?.uniqueUsers || 0}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Errors */}
      {stats && stats.topErrors.length > 0 && (
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-800 dark:text-gray-200 font-normal">Top Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topErrors.slice(0, 5).map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/20 dark:bg-gray-700/20 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-normal text-gray-800 dark:text-gray-200 truncate">{error.message}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-light">
                      Last seen: {formatDate(error.lastSeen)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="bg-red-600 text-white border-0 font-light">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-gray-800 dark:text-gray-200 font-normal">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/errors?project=${project.project?.id || projectId}`}>
              <Button variant="outline" size="sm" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-normal">
                <IconAlertCircle className="size-4 mr-2 text-red-600 dark:text-red-400" />
                View All Errors
              </Button>
            </Link>
            <Link href={`/dashboard/sessions?project=${project.project?.id || projectId}`}>
              <Button variant="outline" size="sm" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                <IconActivity className="size-4 mr-2 text-blue-600 dark:text-blue-400" />
                View Sessions
              </Button>
            </Link>
            <Button variant="outline" size="sm" disabled className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-normal opacity-50">
              <IconKey className="size-4 mr-2 text-gray-600 dark:text-gray-400" />
              Regenerate API Key
            </Button>
          </div>
        </CardContent>
      </Card>

                <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <h4 className="text-sm font-normal text-gray-700 dark:text-gray-300 mb-4">SDK Integration Examples</h4>
            <div className="w-full">
              <CodeBlock
                language="tsx"
                filename="Revi Integration"
                tabs={[
                  {
                    name: "Next.js",
                    code: `'use client';

import { Monitor } from 'revi-monitor';
import { createContext, useContext, ReactNode } from 'react';

// Initialize monitor with your API key
const monitor = new Monitor({
  apiKey: '${project.project?.api_key}',
  apiUrl: 'https://api.revi.dev',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});

// Create context for React
const ReviContext = createContext(monitor);

export const useRevi = () => {
  const monitor = useContext(ReviContext);
  return { monitor };
};

interface ReviProviderProps {
  children: ReactNode;
}

export default function ReviProvider({ children }: ReviProviderProps) {
  // Expose to global window for testing
  if (typeof window !== 'undefined') {
    (window as any).Revi = monitor;
  }

  return (
    <ReviContext.Provider value={monitor}>
      {children}
    </ReviContext.Provider>
  );
}

// In your layout.tsx or _app.tsx:
// <ReviProvider>
//   <YourApp />
// </ReviProvider>`,
                    language: "tsx"
                  },
                  {
                    name: "Vite/React",
                    code: `// main.tsx or index.tsx
import { Monitor } from 'revi-monitor';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize Revi Monitor
const monitor = new Monitor({
  apiKey: '${project.project?.api_key}',
  apiUrl: 'https://api.revi.dev',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});

// Make monitor globally available
window.Revi = monitor;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`,
                    language: "tsx"
                  },
                  {
                    name: "Vanilla JS",
                    code: `// Basic implementation
import { Monitor } from 'revi-monitor';

// Initialize the monitor
const revi = new Monitor({
  apiKey: '${project.project?.api_key}',
  apiUrl: 'https://api.revi.dev',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});

// Optional: Make globally available
window.Revi = revi;

// Manual error tracking
try {
  // Your code here
} catch (error) {
  revi.captureException(error, {
    user: { id: 'user123', email: 'user@example.com' },
    tags: { section: 'checkout' }
  });
}`,
                    language: "javascript"
                  },
                  {
                    name: "Vue.js",
                    code: `// main.js
import { Monitor } from 'revi-monitor';
import { createApp } from 'vue';
import App from './App.vue';

// Initialize Revi Monitor
const monitor = new Monitor({
  apiKey: '${project.project?.api_key}',
  apiUrl: 'https://api.revi.dev',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});

const app = createApp(App);

// Provide monitor to all components
app.provide('revi', monitor);

// Global error handler
app.config.errorHandler = (error, instance, info) => {
  monitor.captureException(error, {
    context: { info, component: instance?.$options.name }
  });
};

// Make globally available
window.Revi = monitor;

app.mount('#app');`,
                    language: "javascript"
                  },
                  {
                    name: "Angular",
                    code: `// app.module.ts
import { Monitor } from 'revi-monitor';
import { NgModule, ErrorHandler, Injectable } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

// Initialize Revi Monitor
const monitor = new Monitor({
  apiKey: '${project.project?.api_key}',
  apiUrl: 'https://api.revi.dev',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});

// Custom error handler
@Injectable()
export class ReviErrorHandler implements ErrorHandler {
  handleError(error: Error): void {
    monitor.captureException(error);
    console.error(error);
  }
}

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [
    { provide: ErrorHandler, useClass: ReviErrorHandler }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {
    // Make monitor globally available
    (window as any).Revi = monitor;
  }
}`,
                    language: "typescript"
                  }
                ]}
              />
            </div>
          </div>
    </div>
  );
}